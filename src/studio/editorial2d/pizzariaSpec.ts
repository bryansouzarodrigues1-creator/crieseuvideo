import type {SceneSpec} from './sceneSpec';
// Demonstration only: durations are estimates until word-level TTS alignment.
export const pizzariaSpec:SceneSpec={
 project:{preset:'editorial_2d_v1',resolution:[1080,1920],fps:30,duration:12,safeArea:{top:180,bottom:260,left:72,right:110}},
 scenes:[{id:'simulacao_conta',theme:'light_cream',layout:'split_metrics_center_stage',elements:[
  {id:'base_500',component:'DotMatrix',slot:'center_stage',props:{cols:25,rows:20,color:'#121110',radius:5.2,gap:20},enter:{atSeconds:1,preset:'cascade_rows_down',duration:.55},exit:{atSeconds:9.2,preset:'fade_out',duration:.26}},
  {id:'extra_250',component:'DotMatrix',slot:'center_stage',props:{cols:25,rows:10,color:'#C89B3C',radius:5.2,gap:20},enter:{atSeconds:6.8,preset:'cascade_rows_down',duration:.85},exit:{atSeconds:9.2,preset:'fade_out',duration:.26}},
  {id:'clients_500',component:'MetricStackItem',slot:'left_rail_1',props:{value:'500',label:'CLIENTES'},enter:{atSeconds:1,preset:'fade_slide_right',duration:.35}},
  {id:'ratio_1_5',component:'MetricStackItem',slot:'right_rail_1',props:{value:'×1,5',label:'PEDIDOS / MÊS'},enter:{atSeconds:6.2,preset:'pop',duration:.3}},
  {id:'counter_20k',component:'AnimatedCounter',slot:'center_stage',props:{value:20000,prefix:'+R$ ',label:'A MAIS POR MÊS'},enter:{atSeconds:9.5,preset:'count_up',duration:.95}},
  {id:'oven',component:'VectorDrawIcon',slot:'center_stage',props:{asset:'oven-brick-01'},enter:{atSeconds:11.3,preset:'draw_path',duration:.7}},
  {id:'caption',component:'EditorialSerifCaption',slot:'lower_third',props:{mode:'blur_mark'},enter:{atSeconds:0,preset:'fade_blur',duration:.25}}
 ]}]
};
