"""Reproducible GLB edit using Python's standard library; retains original Draco data."""
import argparse
import copy
import hashlib
import json
import math
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and length == len(raw)
    chunks, offset = {}, 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        chunks[kind] = raw[offset + 8:offset + 8 + size]
        offset += 8 + size
    doc = json.loads(chunks[0x4E4F534A])
    return doc, bytearray(chunks[0x004E4942][:doc['buffers'][0]['byteLength']]), raw


def linear(hex_color):
    rgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb] + [1]


def mul(a, b):
    x,y,z,w=a; X,Y,Z,W=b
    return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]


def rotate(q, point):
    return mul(mul(q, [*point, 0]), [-q[0],-q[1],-q[2],q[3]])[:3]


def add_box(doc, blob, name, size, material):
    # Independent face vertices retain hard edges and correct outward normals.
    positions, normals, indices = [], [], []
    faces = [((1,0,0), [(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)]),
             ((-1,0,0), [(-1,-1,1),(-1,1,1),(-1,1,-1),(-1,-1,-1)]),
             ((0,1,0), [(-1,1,-1),(-1,1,1),(1,1,1),(1,1,-1)]),
             ((0,-1,0), [(-1,-1,1),(-1,-1,-1),(1,-1,-1),(1,-1,1)]),
             ((0,0,1), [(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]),
             ((0,0,-1), [(1,-1,-1),(-1,-1,-1),(-1,1,-1),(1,1,-1)])]
    for normal, corners in faces:
        start=len(positions)//3
        positions.extend(c[i]*size[i]/2 for c in corners for i in range(3))
        normals.extend(normal*4)
        indices.extend(start+i for i in [0,1,2,0,2,3])
    return add_mesh(doc, blob, name, positions, normals, indices, material)


def add_mesh(doc, blob, name, positions, normals, indices, material, uvs=None):
    def accessor(values, fmt, components, component_type, target, bounds=False):
        while len(blob)%4: blob.append(0)
        data=struct.pack('<'+fmt*len(values), *values)
        view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data),'target':target})
        blob.extend(data)
        item={'bufferView':view,'componentType':component_type,'count':len(values)//components,'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[components]}
        if bounds:
            item.update(min=[min(values[i::components]) for i in range(components)],max=[max(values[i::components]) for i in range(components)])
        result=len(doc['accessors']);doc['accessors'].append(item);return result
    pos=accessor(positions,'f',3,5126,34962,True)
    norm=accessor(normals,'f',3,5126,34962)
    idx=accessor(indices,'H',1,5123,34963)
    attributes={'POSITION':pos,'NORMAL':norm}
    if uvs is not None:attributes['TEXCOORD_0']=accessor(uvs,'f',2,5126,34962)
    mesh=len(doc['meshes'])
    doc['meshes'].append({'name':name,'primitives':[{'attributes':attributes,'indices':idx,'material':material}]})
    return mesh


def add_lathe(doc, blob, name, profile, segments, material):
    """Flat-shaded revolved profile with closed ends; profile is (height, radius)."""
    positions, normals, indices = [], [], []

    def triangle(a, b, c):
        u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(x*x for x in n))
        if length<1e-10:return
        n=[x/length for x in n]
        start=len(positions)//3
        for p in (a,b,c):positions.extend(p);normals.extend(n)
        indices.extend([start,start+1,start+2])

    def point(ring, j):
        y,r=ring;angle=2*math.pi*j/segments
        return [r*math.cos(angle),y,r*math.sin(angle)]
    for lo,hi in zip(profile,profile[1:]):
        for j in range(segments):
            a,b,c,d=point(lo,j),point(hi,j),point(hi,j+1),point(lo,j+1)
            triangle(a,b,c);triangle(a,c,d)
    for j in range(segments):
        triangle([0,profile[0][0],0],point(profile[0],j),point(profile[0],j+1))
        triangle([0,profile[-1][0],0],point(profile[-1],j+1),point(profile[-1],j))
    return add_mesh(doc,blob,name,positions,normals,indices,material)


def remove_legacy_mount(doc,blob,source_path):
    from inspect_tail import components
    subprocess.run(['node',str(ROOT/'tools/decode_tail.cjs'),str(source_path.resolve())],cwd=ROOT,check=True)
    entry=json.loads((ROOT/'artifacts/tail-decoded.json').read_text())['120']
    candidates=[c for c in components(entry) if c['min'][0]>-20 and c['max'][0]<20 and c['min'][2]>70 and c['max'][1]>40]
    assert len(candidates)==1,'Expected exactly one complete legacy rear mount.'
    removed=set(candidates[0]['vertices'])
    kept=[]
    for i in range(0,len(entry['indices']),3):
        face=entry['indices'][i:i+3]
        assert all(v in removed for v in face) or all(v not in removed for v in face)
        if face[0] not in removed:kept.extend(face)
    used=sorted(set(kept));remap={v:i for i,v in enumerate(used)}
    attrs=entry['attributes']
    positions=[attrs['POSITION'][v*3+k] for v in used for k in range(3)]
    normals=[]
    for v in used:
        normal=attrs['NORMAL'][v*3:v*3+3];length=math.sqrt(sum(x*x for x in normal))
        normals.extend(x/length for x in normal)
    uv=[attrs['TEXCOORD_0'][v*2+k] for v in used for k in range(2)]
    newmesh=add_mesh(doc,blob,'TPU_Without_Legacy_Tail_Socket',positions,normals,[remap[v] for v in kept],24,uv)
    doc['meshes'][120]=doc['meshes'].pop(newmesh)
    return {'mesh':120,'removedVertices':len(removed),'retainedVertices':len(used),'removedWorldBounds':{'min':candidates[0]['min'],'max':candidates[0]['max']}}


def socket_rotation(sign):
    # Local +Y is exactly the outward normal of the mounting facet.
    q=[.36,0,-sign*.48,1.8]
    length=math.sqrt(sum(v*v for v in q))
    return [v/length for v in q]


def roof_height(x,z):
    return 36.8-.6*abs(x)-.45*(z-102)


def add_tail_housing(doc,blob,material):
    # One continuous shell, with a central ridge and two deliberately angled
    # mounting faces. Each connector and screw has an actual recessed opening.
    positions=[];normals=[];indices=[]
    def tri(a,b,c,up=False):
        u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        if up and n[1]<0:b,c=c,b;n=[-v for v in n]
        length=math.sqrt(sum(x*x for x in n))
        if length<1e-10:return
        n=[x/length for x in n]
        start=len(positions)//3
        for p in (a,b,c):positions.extend(p);normals.extend(n)
        indices.extend([start,start+1,start+2])
    # The original white upper plate ends at Z=82.586, underside Y=33.750.
    # A thin tongue slips under it; the high socket shoulder starts behind it.
    # Three section vertices (left, ridge, right) allow a continuous faceted loft.
    sections=[(72,12,33.65,33.65,30.7),(83,14,33.65,33.65,30.7)]
    for step in range(1,9):
        t=step/8;blend=t*t*(3-2*t)
        sections.append((83+7*t,14+6*t,33.65-3.45*blend,33.65+8.55*blend,30.7-10.7*t))
    tops=[];bottoms=[];top_vertices=[]
    for z,width,edge,ridge,bottom in sections:
        tops.append([[width*j/4,ridge+(edge-ridge)*abs(j/4),z] for j in range(-4,5)])
        bottoms.append([[width*j/4,bottom,z] for j in range(-4,5)])
    for k in range(len(sections)-1):
        for j in range(8):
            start=len(positions)//3
            tri(tops[k][j],tops[k+1][j],tops[k+1][j+1],True)
            tri(tops[k][j],tops[k+1][j+1],tops[k][j+1],True)
            top_vertices.extend(range(start,len(positions)//3))
            tri(bottoms[k][j],bottoms[k][j+1],bottoms[k+1][j+1])
            tri(bottoms[k][j],bottoms[k+1][j+1],bottoms[k+1][j])
        tri(bottoms[k][0],tops[k+1][0],tops[k][0])
        tri(bottoms[k][0],bottoms[k+1][0],tops[k+1][0])
        tri(bottoms[k][-1],tops[k][-1],tops[k+1][-1])
        tri(bottoms[k][-1],tops[k+1][-1],bottoms[k+1][-1])
    # Smooth only the transition skin, retaining hard edges around mounting facets.
    shared={}
    for i in top_vertices:
        key=tuple(round(v,6) for v in positions[i*3:i*3+3])
        shared.setdefault(key,[]).append(i)
    for members in shared.values():
        normal=[sum(normals[i*3+k] for i in members) for k in range(3)]
        length=math.sqrt(sum(v*v for v in normal))
        for i in members:normals[i*3:i*3+3]=[v/length for v in normal]
    for j in range(8):
        tri(bottoms[0][j],tops[0][j],tops[0][j+1])
        tri(bottoms[0][j],tops[0][j+1],bottoms[0][j+1])
    footprint=[(-20,90),(-20,103),(-15,109),(0,109),(15,109),(20,103),(20,90),(0,90)]
    low=[[x,20,z] for x,z in footprint]
    high=[[x,roof_height(x,z),z] for x,z in footprint]
    for i in range(1,len(low)-1):tri(low[0],low[i+1],low[i])
    # No internal front wall: the transition and socket block share an edge.
    for i in range(6):
        j=i+1
        tri(low[i],high[j],high[i]);tri(low[i],low[j],high[j])
    facets=[];vertices=[]
    for sign in [-1,1]:
        border=[[sign*x,z] for x,z in [(0,90),(20,90),(20,103),(15,109),(0,109)]]
        holes=[];rings=[]
        for x,z,radius,depth,inner in [(13,102,5.8,1.1,5.0),(8,93.5,2.9,.8,2.45)]:
            center=[sign*x,roof_height(x,z),z]
            q=socket_rotation(sign)
            outer=[];bottom=[]
            for i in range(32):
                angle=2*math.pi*i/32
                delta=rotate(q,[radius*math.cos(angle),0,radius*math.sin(angle)])
                outer.append([center[k]+delta[k] for k in range(3)])
                delta=rotate(q,[inner*math.cos(angle),-depth,inner*math.sin(angle)])
                bottom.append([center[k]+delta[k] for k in range(3)])
            holes.append([[p[0],p[2]] for p in outer]);rings.extend(outer)
            # Beveled pocket walls and dark floor; hardware seats into the pocket.
            floor=[sum(p[k] for p in bottom)/len(bottom) for k in range(3)]
            for i in range(32):
                j=(i+1)%32
                tri(outer[i],bottom[i],bottom[j],True)
                tri(outer[i],bottom[j],outer[j],True)
                tri(floor,bottom[i],bottom[j],True)
        facets.append({'border':border,'holes':holes})
        vertices.append([[x,roof_height(x,z),z] for x,z in border]+rings)
    result=subprocess.run(['node',str(ROOT/'tools/triangulate-tail.mjs')],input=json.dumps(facets),capture_output=True,text=True,check=True)
    for points,faces in zip(vertices,json.loads(result.stdout)):
        for a,b,c in faces:tri(points[a],points[b],points[c],True)
    return add_mesh(doc,blob,'Faceted_Recessed_Dual_Socket_Housing',positions,normals,indices,material)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'assets/fpv-drone3-v3.glb')
    parser.add_argument('--output',type=Path,default=ROOT/'assets/fpv-drone3-v3-white-blue.glb')
    parser.add_argument('--white',default='#dbe3ed')
    parser.add_argument('--blue',default='#125bd7')
    args=parser.parse_args()
    if args.input.resolve()==args.output.resolve():
        parser.error('Use a different output file to preserve the source.')
    doc,blob,original=read_glb(args.input)
    original_binary=bytes(blob)
    changes=[]
    # These material names are checked against the inspected source model.
    for index,mat in enumerate(doc['materials']):
        name=mat.get('name','')
        if name.startswith('Carbon_Fiber') or name=='battery2':
            color=args.white;label='Ceramic_White_'+name
        elif name=='3D_Printed_TPU_Cyan' or index==29:
            color=args.blue;label='Cobalt_Blue_'+name
        else:
            continue
        pbr=mat.setdefault('pbrMetallicRoughness',{})
        # A dark albedo texture cannot be made white with a multiplicative tint.
        # Keep normal maps, occlusion and other surface detail, replace albedo only.
        pbr.pop('baseColorTexture',None)
        pbr['baseColorFactor']=linear(color)
        pbr['roughnessFactor']=.58 if color==args.white else .48
        pbr['metallicFactor']=.08 if color==args.white else .22
        mat['name']=label
        changes.append({'index':index,'originalName':name,'color':color})

    tail_removal=remove_legacy_mount(doc,blob,args.input)
    antenna_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='wireless')
    # Reference: two equal antennas, symmetric rear sockets and an outward V.
    base=[-13,29,102];newbase=[13,29,102]
    mount_material=len(doc['materials'])
    doc['materials'].append({'name':'Graphite_Rebuilt_Tail_Housing','pbrMetallicRoughness':{'baseColorFactor':linear('#292d34'),'metallicFactor':.1,'roughnessFactor':.62}})
    black=len(doc['materials'])
    doc['materials'].append({'name':'Antenna_Graphite','pbrMetallicRoughness':{'baseColorFactor':linear('#20232a'),'metallicFactor':.18,'roughnessFactor':.48}})
    gold=len(doc['materials'])
    doc['materials'].append({'name':'Antenna_Brass_Connectors','pbrMetallicRoughness':{'baseColorFactor':linear('#c9a455'),'metallicFactor':.72,'roughnessFactor':.3}})
    meshes=[
        add_lathe(doc,blob,'SMA_Hex_Connector',[(-.7,4.5),(6.3,4.5),(7.3,3.2)],6,gold),
        add_lathe(doc,blob,'Antenna_Strain_Relief',[(7,3),(15,2.8),(19,1.8)],16,black),
        add_lathe(doc,blob,'Antenna_Shaft',[(17,1.55),(102,1.55)],24,black),
        add_lathe(doc,blob,'Faceted_Antenna_Radome',[(100,3),(102,6.5),(106,9),(114,9),(119,5.5),(120,2.5)],10,black),
    ]
    directions=[]
    def antenna_group(sign, location, name):
        direction=[sign*.48,.80,.36]
        length=math.sqrt(sum(x*x for x in direction));direction=[x/length for x in direction]
        directions.append(direction)
        q=[direction[2],0,-direction[0],1+direction[1]]
        length=math.sqrt(sum(x*x for x in q));q=[x/length for x in q]
        children=[]
        for i,mesh in enumerate(meshes):
            children.append(len(doc['nodes']));doc['nodes'].append({'name':name+'-'+str(i),'mesh':mesh})
        index=len(doc['nodes'])
        doc['nodes'].append({'name':name,'translation':location,'rotation':q,'children':children})
        return index
    left=antenna_group(-1,base,'antenna-left-assembly')
    right=antenna_group(1,newbase,'antenna-right-assembly')
    mesh=add_tail_housing(doc,blob,mount_material)
    mount_index=len(doc['nodes'])
    doc['nodes'].append({'name':'rear-dual-antenna-mount','mesh':mesh})
    # Socket collars are integrated in each antenna assembly, flush against the housing.
    collar=add_lathe(doc,blob,'Socket_Retaining_Collar',[(-1,4.9),(-.3,4.9),(0,4.4)],12,black)
    for assembly in [left,right]:
        node=len(doc['nodes']);doc['nodes'].append({'name':'socket-collar-'+str(assembly),'mesh':collar})
        doc['nodes'][assembly]['children'].append(node)
    # Keep the rebuilt housing with the frame during explosion. Wrap the original
    # frame transform instead of applying its rotated coordinate system to new geometry.
    frame_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='Sketchfab_model')
    old_frame=copy.deepcopy(doc['nodes'][frame_index]);old_frame['name']='original-frame-preserved'
    old_frame_index=len(doc['nodes']);doc['nodes'].append(old_frame)
    doc['nodes'][frame_index]={'name':'Sketchfab_model','children':[old_frame_index,mount_index]}
    screws=add_lathe(doc,blob,'Tail_Mount_Fastener',[(-.7,2.35),(.15,2.35),(.45,1.6)],12,black)
    for x in [-8,8]:
        node=len(doc['nodes']);doc['nodes'].append({'name':'tail-fastener-'+str(x),'mesh':screws,'translation':[x,roof_height(x,93.5),93.5],'rotation':socket_rotation(-1 if x<0 else 1)})
        doc['nodes'][frame_index]['children'].append(node)
    doc['nodes'][antenna_index]={'name':'wireless','children':[left]}
    group_index=len(doc['nodes'])
    doc['nodes'].append({'name':'wireless-extra','children':[right],'extras':{'description':'Right antenna of symmetrical V pair, based on supplied visual reference.'}})
    doc['scenes'][doc.get('scene',0)]['nodes'].append(group_index)
    doc['buffers'][0]['byteLength']=len(blob)
    doc['asset'].setdefault('extras',{})['localEdit']={'palette':'white-blue','script':'tools/edit_drone.py','sourceSHA256':hashlib.sha256(original).hexdigest()}
    assert bytes(blob[:len(original_binary)])==original_binary
    json_bytes=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    json_bytes+=b' '*((-len(json_bytes))%4)
    blob.extend(b'\0'*((-len(blob))%4))
    result=struct.pack('<III',0x46546C67,2,12+8+len(json_bytes)+8+len(blob))+struct.pack('<II',len(json_bytes),0x4E4F534A)+json_bytes+struct.pack('<II',len(blob),0x004E4942)+blob
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_bytes(result)
    assert args.input.read_bytes()==original
    report={'input':str(args.input),'output':str(args.output),'sourceSHA256':hashlib.sha256(original).hexdigest(),'outputSHA256':hashlib.sha256(result).hexdigest(),'changedMaterials':changes,'addedTopLevelPart':'wireless-extra','originalBinaryPreserved':True,'legacyTailRemoval':tail_removal,'antennaBase':base,'newAntennaBase':newbase,'antennaDirections':directions,'antennaLength':120,'layout':'rear-set recessed sockets with a continuous under-plate tongue transition','parts':len(doc['scenes'][doc.get('scene',0)]['nodes'])}
    report_path=ROOT/'artifacts/model-edit-report.json';report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__': main()
