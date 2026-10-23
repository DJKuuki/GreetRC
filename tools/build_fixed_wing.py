"""Convert the supplied single-mesh OBJ into a self-contained sport-livery GLB."""
import json, struct, io, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from edit_drone import add_mesh
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'assets/base.obj'
vertices=[];normals=[];faces=[]
for line in source.read_text().splitlines():
    a=line.split()
    if not a:continue
    if a[0]=='v':vertices.append(tuple(map(float,a[1:4])))
    elif a[0]=='vn':normals.append(tuple(map(float,a[1:4])))
    elif a[0]=='f':
        face=[tuple(int(i) if i else 0 for i in part.split('/')) for part in a[1:]]
        for i in range(1,len(face)-1):faces.append([face[0],face[i],face[i+1]])
# Planar livery is embedded, so it works entirely offline without an MTL file.
W,H=3072,2048
tex=Image.new('RGB',(W,H),'#f4f7fa');d=ImageDraw.Draw(tex)
def uv(x,z):return ((x+1)/2*W,(.57-z)/1.14*H)
def poly(points,color):d.polygon([uv(x,z) for x,z in points],fill=color)
for side in [-1,1]:
    def wing(points,color):poly([(side*x,z) for x,z in points],color)
    wing([(.13,.5),(.98,.5),(.98,-.55),(.5,-.55),(.17,.05)],'#1166e8')
    wing([(.30,.52),(.98,.52),(.98,-.32),(.65,-.18)],'#16c8df')
    wing([(.60,.55),(.98,.55),(.98,.16),(.79,.08)],'#102d52')
    wing([(.40,.55),(.49,.55),(.89,-.48),(.81,-.48)],'#ff692a')
    wing([(.51,.55),(.535,.55),(.965,-.48),(.94,-.48)],'#f9fafb')
poly([(-.035,-.56),(.035,-.56),(.05,.1),(-.05,.1)],'#ff692a')
poly([(-.012,-.56),(.012,-.56),(.02,.15),(-.02,.15)],'#102d52')
# Discrete sporty tail mark, if the mesh intersects this planar region.
font=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',64)
d.text(uv(.50,-.13),'GA / 01',font=font,fill='white')
tex.save(ROOT/'assets/fixed-wing-sport-livery.png')
image=io.BytesIO();tex.save(image,format='PNG')
blob=bytearray(image.getvalue());image_length=len(blob)
doc={'asset':{'version':'2.0','generator':'Greet Aero local OBJ conversion','extras':{'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest()}},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'fixed-wing','children':[]}],'meshes':[],'accessors':[],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':image_length}],'buffers':[{'byteLength':0}],'images':[{'bufferView':0,'mimeType':'image/png'}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'textures':[{'sampler':0,'source':0}],'materials':[{'name':'Greet_Aero_Sport_White_Blue_Cyan_Orange','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':.12,'roughnessFactor':.38},'doubleSided':True}]}
# Chunking keeps indices portable as unsigned shorts, preserving source normals.
for start in range(0,len(faces),18000):
    positions=[];ns=[];uvs=[];indices=[];mapping={}
    for face in faces[start:start+18000]:
        for ref in face:
            if ref not in mapping:
                mapping[ref]=len(mapping)
                point=vertices[ref[0]-1];positions.extend(c*200 for c in point)
                ns.extend(normals[ref[2]-1]);uvs.extend([(point[0]+1)/2,(.57-point[2])/1.14])
            indices.append(mapping[ref])
    mesh=add_mesh(doc,blob,'Sport_Airframe',positions,ns,indices,0,uvs)
    doc['nodes'][0]['children'].append(len(doc['nodes']));doc['nodes'].append({'mesh':mesh,'name':f'airframe-surface-{start}'})
doc['buffers'][0]['byteLength']=len(blob)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);blob+=b'\0'*((-len(blob))%4)
out=struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
(ROOT/'assets/fixed-wing-sport.glb').write_bytes(out)
print(f'Exported {len(faces)} triangles, {len(out)} bytes; original OBJ preserved.')
