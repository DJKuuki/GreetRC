import json
from pathlib import Path

def components(entry):
    pos=entry['attributes']['POSITION'];parents=list(range(len(pos)//3))
    def find(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]];i=parents[i]
        return i
    def union(a,b):parents[find(a)]=find(b)
    welded={}
    for i in range(len(parents)):
        key=tuple(round(v,3) for v in pos[i*3:i*3+3])
        if key in welded:union(i,welded[key])
        else:welded[key]=i
    indices=entry['indices']
    for i in range(0,len(indices),3):
        a,b,c=indices[i:i+3];union(a,b);union(a,c)
    groups={}
    for i in range(len(parents)):groups.setdefault(find(i),[]).append(i)
    result=[]
    for members in groups.values():
        world=[(pos[i*3],1.2522358894348145-pos[i*3+1],-1.4021127223968506-pos[i*3+2]) for i in members]
        result.append({'vertices':members,'min':[min(p[k] for p in world) for k in range(3)],'max':[max(p[k] for p in world) for k in range(3)]})
    return sorted(result,key=lambda c:len(c['vertices']),reverse=True)

if __name__=='__main__':
    data=json.loads(Path('artifacts/tail-decoded.json').read_text())
    for key,entry in data.items():
        print('MESH',key)
        for i,c in enumerate(components(entry)):
            if len(c['vertices'])>20:print(i,len(c['vertices']),c['min'],c['max'])
