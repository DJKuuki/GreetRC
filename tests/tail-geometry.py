import json
import struct
from pathlib import Path

raw=Path('assets/fpv-drone3-v3-white-blue.glb').read_bytes()
length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]);blob=raw[28+length:]
primitive=doc['meshes'][120]['primitives'][0]
assert 'KHR_draco_mesh_compression' not in primitive.get('extensions',{})
acc=doc['accessors'][primitive['attributes']['POSITION']]
view=doc['bufferViews'][acc['bufferView']]
values=struct.unpack_from('<'+'f'*(acc['count']*3),blob,view.get('byteOffset',0)+acc.get('byteOffset',0))
for i in range(acc['count']):
    x,y,z=values[3*i:3*i+3]
    world=(x,1.2522358894348145-y,-1.4021127223968506-z)
    assert not(abs(world[0])<20 and world[1]>13 and world[2]>70), 'Old blue tail mount still exists'
frame=next(n for n in doc['nodes'] if n.get('name')=='Sketchfab_model')
assert any(doc['nodes'][i]['name']=='rear-dual-antenna-mount' for i in frame['children'])
assert any(doc['nodes'][i]['name']=='original-frame-preserved' for i in frame['children'])
assert acc['count']==5613
print('PASS: entire legacy tail mount removed; remaining TPU geometry preserved; new housing belongs to frame.')

# Check the exported shell, not only the generator's intended dimensions.
import math
def read_accessor(index):
    a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
    size={'SCALAR':1,'VEC3':3}[a['type']]
    fmt={5126:'f',5123:'H'}[a['componentType']]
    return struct.unpack_from('<'+fmt*(a['count']*size),blob,v.get('byteOffset',0)+a.get('byteOffset',0))
housing=next(n for n in doc['nodes'] if n.get('name')=='rear-dual-antenna-mount')
p=doc['meshes'][housing['mesh']]['primitives'][0]
positions=read_accessor(p['attributes']['POSITION']);normals=read_accessor(p['attributes']['NORMAL']);ids=read_accessor(p['indices'])
front=[positions[i:i+3] for i in range(0,len(positions),3) if positions[i+2]<=82.5862]
assert front and max(v[1] for v in front)<33.7503, 'Tail penetrates the white upper plate'
assert max(v[1] for v in front)>33.6, 'Tongue is not seated beneath the upper plate'
assert min(v[1] for v in front)>30, 'Front tongue interferes with electronics below'
print('PASS: connecting tongue seats beneath the white plate with clearance; socket shoulder starts behind plate.')
for sign in [-1,1]:
    normal=[sign*.48,.8,.36]
    faces=[]
    for i in range(0,len(ids),3):
        indices=ids[i:i+3]
        if all(abs(normals[indices[0]*3+k]-normal[k])<1e-5 for k in range(3)):
            faces.append([positions[j*3:j*3+3] for j in indices])
    assert len(faces)>20,'Missing drilled mounting facet'
    for x,z in [(sign*13,102),(sign*8,93.5)]:
        # The planar facet must leave a real hole at each hardware axis.
        for a,b,c in faces:
            if abs(a[1]-(36.8-.6*abs(a[0])-.45*(a[2]-102)))>1e-4:continue
            cross=lambda a,b:(b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0])
            edges=[cross(a,b),cross(b,c),cross(c,a)]
            assert not(all(e>1e-6 for e in edges) or all(e< -1e-6 for e in edges)), 'Uncut face spans hardware opening'
    screw=next(n for n in doc['nodes'] if n.get('name')=='tail-fastener-'+str(sign*8))
    qx,qy,qz,qw=screw['rotation']
    axis=[2*(qx*qy-qz*qw),1-2*(qx*qx+qz*qz),2*(qy*qz+qx*qw)]
    assert math.dist(axis,normal)<1e-6,'Screw not perpendicular to mounting face'
print('PASS: two sloped mounting faces have actual connector/screw openings; screw axes match surface normals.')
