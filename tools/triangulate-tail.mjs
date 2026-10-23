import {ShapeUtils, Vector2} from 'three';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const faces = JSON.parse(input).map(({border, holes}) =>
  ShapeUtils.triangulateShape(border.map(p => new Vector2(...p)),
    holes.map(h => h.map(p => new Vector2(...p)))));
process.stdout.write(JSON.stringify(faces));
