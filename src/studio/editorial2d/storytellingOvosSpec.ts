import type {StorytellingSpec} from './storytelling';
/**
 * An ORIGINAL 42-second example based on the reusable storytelling language:
 * two background styles, six actor poses and simple arithmetic.
 * This is not a recreation of another creator's episode.
 */
export const storytellingOvos:StorytellingSpec={
 version:1,title:'Vender muito é lucrar?',duration:42,fps:30,scenes:[
 {id:'hook',start:0,end:8,theme:'studio_dark',headline:'Vender muito é lucrar?',caption:'Dois vendedores, dois resultados diferentes.',blocks:[
  {type:'actors',actors:[
   {id:'vend1',x:310,y:980,scale:1.2,facing:'right',pose:'thinking',bodyColor:'#41638F',skinColor:'#EDC7A1',shirtLabel:'1'},
   {id:'vend2',x:780,y:980,scale:1.2,facing:'left',pose:'talking',bodyColor:'#238C7B',skinColor:'#C98E6C',shirtLabel:'2'}
  ]}
 ]},
 {id:'farm',start:8,end:17,theme:'farm_light',headline:'O mesmo produto.',caption:'Mais galinhas, mais produção — e também mais custos.',blocks:[
  {type:'icon_grid',id:'hens_20',icon:'hen',count:20,columns:5,x:400,y:765,gapX:110,gapY:112}
 ]},
 {id:'calculation',start:17,end:27,theme:'math_cream',headline:'O que sobra?',caption:'O valor vendido não é o lucro final.',blocks:[
  {type:'icon_grid',id:'eggs_20',icon:'egg',count:20,columns:5,x:250,y:520,gapX:125,gapY:95},
  {type:'equation',x:160,y:1030,rows:[
   {label:'Vendas',amount:400,type:'income'},
   {label:'Custos diretos',amount:220,type:'cost'},
   {label:'Sobra antes de outros gastos',amount:180,type:'result'}
  ]}
 ]},
 {id:'steps',start:27,end:36,theme:'studio_dark',headline:'Repetir. Controlar. Reinvestir.',caption:'Crescer depende de clientes, margens e reserva.',blocks:[
  {type:'concept',title:'VENDA',detail:'CUSTOS + RESERVA'}
 ]},
 {id:'outro',start:36,end:42,theme:'studio_dark',headline:'Vender é o começo.',caption:'Entender o lucro muda o jogo.',blocks:[
  {type:'concept',title:'O JOGO',detail:'CONTROLE FINANCEIRO'}
 ]}
 ]};
