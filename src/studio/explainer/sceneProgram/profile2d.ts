/** Safe 2D outline for extruded 3D silhouettes. Pure numeric validation.
 * Supports convex and concave outlines, rejects zero area, duplicate edges
 * and self intersections before Three.js receives untrusted model data. */
export type Polygon2DPoint = [number, number];

const cross = (a:Polygon2DPoint,b:Polygon2DPoint,c:Polygon2DPoint)=>
  (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

export function validatePolygon2D(raw:unknown,maxPoints=24):Polygon2DPoint[] {
  const reject=(reason:string):never=>{throw new Error('Contorno 2D inválido: '+reason);};
  if(!Array.isArray(raw)||raw.length<3||raw.length>maxPoints)
    return reject('o perfil deve ter entre 3 e '+maxPoints+' vértices.');
  const points=raw.map((p):Polygon2DPoint=>{
    if(!Array.isArray(p)||p.length!==2||p.some(n=>
      typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>80))
      return reject('pontos devem ser pares numéricos finitos.');
    return [p[0],p[1]];
  });
  const n=points.length;
  for(let i=0;i<n;i++){
    const a=points[i],b=points[(i+1)%n];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<.005)
      reject('lados degenerados ou vértices duplicados.');
  }
  let twiceArea=0;
  for(let i=0;i<n;i++){
    const a=points[i],b=points[(i+1)%n];
    twiceArea+=a[0]*b[1]-b[0]*a[1];
  }
  if(Math.abs(twiceArea)<.02)return reject('área muito pequena.');
  const on=(a:Polygon2DPoint,b:Polygon2DPoint,p:Polygon2DPoint)=>
    Math.min(a[0],b[0])-1e-8<=p[0]&&p[0]<=Math.max(a[0],b[0])+1e-8&&
    Math.min(a[1],b[1])-1e-8<=p[1]&&p[1]<=Math.max(a[1],b[1])+1e-8;
  const intersects=(a:Polygon2DPoint,b:Polygon2DPoint,c:Polygon2DPoint,d:Polygon2DPoint)=>{
    const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
    if(x*y<0&&z*w<0)return true;
    return (Math.abs(x)<1e-8&&on(a,b,c))||(Math.abs(y)<1e-8&&on(a,b,d))||
      (Math.abs(z)<1e-8&&on(c,d,a))||(Math.abs(w)<1e-8&&on(c,d,b));
  };
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    if(j===i+1||(i===0&&j===n-1))continue;
    if(intersects(points[i],points[(i+1)%n],points[j],points[(j+1)%n]))
      reject('o polígono se cruza.');
  }
  return points;
}
