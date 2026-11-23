import type {StorytellingSpec} from './storytelling';
/** A second original story using the SAME 2D reusable components. All amounts are illustrative. */
export const storytellingLoja:StorytellingSpec={
 version:1,title:'Loja cheia. Caixa vazio?',duration:34,fps:30,scenes:[
 {id:'abertura',start:0,end:7,theme:'studio_dark',headline:'Loja cheia. Caixa vazio?',caption:'Uma loja vende bastante, mas sobra pouco.',blocks:[
  {type:'actors',actors:[{id:'comerciante',x:550,y:990,scale:1.3,facing:'right',pose:'thinking',bodyColor:'#A86553',skinColor:'#EBC19D',shirtLabel:'L'}]}
 ]},
 {id:'vendas',start:7,end:14,theme:'city_shop',headline:'Os pedidos entram.',caption:'Cada pedido traz receita para o caixa.',blocks:[
  {type:'cash_register',id:'pedidos',orders:16,x:540,y:1135}
 ]},
 {id:'custos',start:14,end:24,theme:'math_cream',headline:'Mas e os custos?',caption:'Exemplo fictício, antes de despesas fixas.',blocks:[
  {type:'equation',x:170,y:810,chart:'split_bar',rows:[
   {label:'Recebido em vendas',amount:900,type:'income'},
   {label:'Produtos e entregas',amount:650,type:'cost'},
   {label:'Sobra parcial',amount:250,type:'result'}
  ]}
 ]},
 {id:'aprendizado',start:24,end:30,theme:'studio_dark',headline:'Faturamento não é lucro.',caption:'Também existem aluguel, impostos e outros gastos.',blocks:[
  {type:'concept',title:'R$ 900',detail:'NÃO É LUCRO'}
 ]},
 {id:'fim',start:30,end:34,theme:'studio_dark',headline:'Entenda sua margem.',caption:'O importante é o resultado depois dos custos.',blocks:[
  {type:'concept',title:'PLANEJE',detail:'CRESÇA COM CONTROLE'}
 ]}
 ]};
