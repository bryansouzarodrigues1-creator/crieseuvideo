import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowRight, ArrowUpRight, Captions, Check, ChevronDown, CirclePlay,
  Clapperboard, Clock3, Download, Film, LockKeyhole, MonitorPlay,
  Scissors, SlidersHorizontal, Sparkles, Users, WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import '../launch-v2.css';

const WHATSAPP_GROUP = 'https://chat.whatsapp.com/Jba8u5eY9heEw9fGj9rnCg?s=cl&p=a&iam=2';
const LAUNCH_TIME = new Date('2026-12-05T19:00:00-03:00').getTime();

export const Route = createFileRoute('/')({
  ssr: false,
  head: () => ({
    meta: [
      { title: 'CrieSeuVideo | Suas ideias merecem virar animação' },
      { name: 'description', content: 'Conheça o CrieSeuVideo: transforme roteiros em cenas animadas, revise no editor e exporte seus vídeos. Saiba mais sobre o lançamento em 5 de dezembro.' },
      { property: 'og:title', content: 'CrieSeuVideo — Sua ideia merece sair do papel' },
      { property: 'og:description', content: 'Conheça os benefícios reais do estúdio de animações 2D e acompanhe o lançamento previsto para 5 de dezembro.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: LaunchV2,
});

function Clock() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.floor((LAUNCH_TIME - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = remaining ?? 0;
  const values = [
    { label: 'dias', value: Math.floor(seconds / 86400) },
    { label: 'horas', value: Math.floor(seconds / 3600) % 24 },
    { label: 'min', value: Math.floor(seconds / 60) % 60 },
    { label: 'seg', value: seconds % 60 },
  ];
  return <div className="csv2-clock" aria-label="Contagem regressiva para 5 de dezembro, 19 horas, horário de Brasília">
    {values.map((v) => <div className="csv2-clock-tile" key={v.label}>
      <strong>{remaining === null ? '--' : String(v.value).padStart(2, '0')}</strong>
      <span>{v.label}</span>
    </div>)}
  </div>;
}

function Brand() {
  return <a href="/" className="csv2-brand" aria-label="CrieSeuVideo, início">
    <span className="csv2-brand-icon"><Clapperboard size={20} strokeWidth={2.5} /></span>
    <span>crie<span>seu</span><b>video</b><i>.</i></span>
  </a>;
}

function WhatsAppLink({className = '', children = 'Quero entrar no grupo'}: {className?:string;children?:string}) {
  return <a className={'csv2-button csv2-button-red '+className} target="_blank"
    rel="noopener noreferrer" href={WHATSAPP_GROUP}>
    <Users size={18} strokeWidth={2.5} aria-hidden="true"/>
    <span>{children}</span>
    <ArrowUpRight size={18} aria-hidden="true"/>
  </a>;
}

function Preview() {
  return <div className="csv2-showcase" aria-label="Ilustração do fluxo visual de criação">
    <div className="csv2-showcase-badge"><span className="csv2-pulse"/> UMA IDEIA, VÁRIAS CENAS</div>
    <div className="csv2-showcase-shell">
      <div className="csv2-showcase-top">
        <span><span className="csv2-preview-red-dot"/><span className="csv2-preview-yellow-dot"/><span className="csv2-preview-grey-dot"/></span>
        <span>VISUALIZAÇÃO · 9:16</span>
        <MonitorPlay size={16}/>
      </div>
      <div className="csv2-showcase-main">
        <div className="csv2-video-stage">
          <div className="csv2-stage-grid"/>
          <span className="csv2-video-eyebrow">CENA 02 · MOTION 2D</span>
          <div className="csv2-stage-headline">
            <span>UMA</span><span>IDEIA.</span><strong>EM MOVIMENTO.</strong>
          </div>
          <div className="csv2-stage-visual">
            <div className="csv2-stage-shape csv2-stage-shape-a"/>
            <div className="csv2-stage-shape csv2-stage-shape-b"/>
            <div className="csv2-stage-center"><WandSparkles size={38}/></div>
            <div className="csv2-stage-bars">
              <i/><i/><i/><i/><i/><i/><i/>
            </div>
          </div>
          <div className="csv2-stage-caption">Sua história <strong>ganha forma.</strong></div>
          <div className="csv2-stage-safe-label">TEXTO + MOVIMENTO + CENAS</div>
        </div>
        <div className="csv2-showcase-side">
          <div><span>01</span><b>IDEIA</b><p>Você começa com o tema</p></div>
          <div className="csv2-showcase-side-selected"><span>02</span><b>CENAS</b><p>O roteiro ganha forma</p></div>
          <div><span>03</span><b>REVISÃO</b><p>Ajuste antes de exportar</p></div>
          <div><span>04</span><b>ARQUIVO</b><p>Leve seu vídeo com você</p></div>
        </div>
      </div>
      <div className="csv2-showcase-bottom">
        <span><CirclePlay size={16}/> PRÉVIA DA SEQUÊNCIA</span>
        <div className="csv2-clip-track"><i/><i/><i/><i/><i/></div>
        <span>00:12 / 00:30</span>
      </div>
    </div>
    <div className="csv2-showcase-floating csv2-showcase-floating-a"><Check size={15}/> Roteiro em cenas</div>
    <div className="csv2-showcase-floating csv2-showcase-floating-b"><Captions size={16}/> Legendas organizadas</div>
    <p className="csv2-illustration-note">Representação ilustrativa da interface. Não é um vídeo gerado automaticamente.</p>
  </div>;
}

const benefits = [
  {
    Icon: WandSparkles, order:'01', label:'MENOS TRABALHO REPETITIVO',
    title:'Do roteiro para as cenas',
    desc:'Escreva a ideia ou um roteiro. O editor 2D organiza a história em cenas e desenha elementos por código, sem precisar montar todos os quadros do zero.',
  },
  {
    Icon: SlidersHorizontal, order:'02', label:'CONTROLE CRIATIVO',
    title:'Veja, ajuste e melhore',
    desc:'Acompanhe a prévia, revise textos e cenas e confira o resultado antes de iniciar a exportação. Você continua no controle.',
  },
  {
    Icon: Captions, order:'03', label:'PRONTO PARA TELA VERTICAL',
    title:'Formato e legendas pensados para redes',
    desc:'Trabalhe com vídeo vertical 9:16 e legendas em áreas organizadas, ajudando a evitar texto cortado na tela.',
  },
  {
    Icon: Download, order:'04', label:'RESULTADO QUE VOCÊ LEVA',
    title:'Exporte o seu trabalho',
    desc:'O estúdio tem fluxo de gravação e download de vídeo. MP4 está disponível em navegadores compatíveis; em outros, o formato pode ser WebM.',
  },
];

function LaunchV2() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({data}) => {
      if (alive) setSignedIn(Boolean(data.user));
    }).catch(() => {});
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setSignedIn(Boolean(session?.user));
    });
    return () => {alive = false; data.subscription.unsubscribe();};
  }, []);

  return <div className="csv2-app">
    <div className="csv2-top-strip">
      <span className="csv2-top-pin">PRÉ-LANÇAMENTO</span>
      <span>Estamos construindo algo novo para quem cria conteúdo.</span>
      <a href="#lancamento">Conheça a data <ArrowRight size={13}/></a>
    </div>
    <header className="csv2-header">
      <div className="csv2-container csv2-header-inside">
        <Brand/>
        <nav className="csv2-nav" aria-label="Navegação principal">
          <a href="#beneficios">Benefícios</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#lancamento">Lançamento</a>
        </nav>
        <a className="csv2-header-login" href="/estudio">
          <LockKeyhole size={15}/>{signedIn?'Abrir meu estúdio':'Entrar / Criar conta'}<ArrowUpRight size={15}/>
        </a>
      </div>
    </header>

    <main>
      <section className="csv2-hero" aria-labelledby="csv2-hero-title">
        <div className="csv2-hero-glow"/>
        <div className="csv2-container csv2-hero-layout">
          <div className="csv2-hero-copy">
            <p className="csv2-kicker"><span className="csv2-kicker-line"/> O PRÓXIMO PASSO DE QUEM CRIA CONTEÚDO</p>
            <h1 id="csv2-hero-title">Sua ideia merece <span>virar vídeo.</span></h1>
            <p className="csv2-hero-lead">
              Transforme um roteiro em cenas animadas, visualize o resultado e prepare seu conteúdo para publicar.
              Um estúdio para você criar mais e perder menos tempo montando tudo manualmente.
            </p>
            <div className="csv2-hero-actions">
              <a className="csv2-button csv2-button-red" href="#beneficios">Descubra o que você pode criar <ArrowRight size={18}/></a>
              <a className="csv2-button csv2-button-ghost" href="#como-funciona"><CirclePlay size={19}/> Veja como funciona</a>
            </div>
            <div className="csv2-hero-subline">
              <span><Check size={16}/> Editor 2D em evolução</span>
              <span><Check size={16}/> Prévia de cenas</span>
              <span><Check size={16}/> Exportação de vídeo</span>
            </div>
          </div>
          <Preview/>
        </div>
        <a href="#beneficios" className="csv2-scroll-cue"><ChevronDown size={18}/> CONHEÇA OS BENEFÍCIOS</a>
      </section>

      <section id="beneficios" className="csv2-benefits csv2-container">
        <div className="csv2-section-intro">
          <p className="csv2-kicker"><span className="csv2-kicker-line"/> O QUE VOCÊ GANHA NA PRÁTICA</p>
          <h2>Mais controle para criar.<br/><span>Menos etapas para começar.</span></h2>
          <p>Sem números inventados ou promessas de resultados. Estas são as capacidades que estamos desenvolvendo e colocando à prova no CrieSeuVideo.</p>
        </div>
        <div className="csv2-benefit-grid">
          {benefits.map(({Icon,order,label,title,desc}) =>
            <article className="csv2-benefit-card" key={order}>
              <div className="csv2-benefit-card-head"><div className="csv2-benefit-icon"><Icon size={24}/></div><span>{order}</span></div>
              <p className="csv2-benefit-label">{label}</p>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>)}
        </div>
      </section>

      <section id="como-funciona" className="csv2-experience">
        <div className="csv2-container csv2-experience-layout">
          <div className="csv2-experience-copy">
            <p className="csv2-kicker"><span className="csv2-kicker-line"/> SIMPLES DE ENTENDER</p>
            <h2>Você traz a história. <span>O estúdio ajuda a construir o vídeo.</span></h2>
            <p className="csv2-experience-intro">Em vez de depender de imagens soltas, o fluxo conecta roteiro, visualização e edição no mesmo ambiente.</p>
            <div className="csv2-experience-list">
              <div><span>01</span><div><b>Escreva sua ideia</b><p>Comece com um assunto e a mensagem que quer transmitir.</p></div></div>
              <div><span>02</span><div><b>Veja as cenas tomando forma</b><p>O motor 2D interpreta um plano visual e desenha os elementos para você revisar.</p></div></div>
              <div><span>03</span><div><b>Revise e exporte</b><p>Ajuste o que for necessário e baixe o arquivo no formato disponível em seu dispositivo.</p></div></div>
            </div>
            <a href="/estudio" className="csv2-link-arrow">Conhecer o estúdio experimental <ArrowUpRight size={19}/></a>
          </div>
          <div className="csv2-experience-art">
            <div className="csv2-experience-card csv2-experience-card-one"><div><Sparkles size={16}/> IDEIA</div><p>“E se a gente explicasse isso em uma animação?”</p></div>
            <div className="csv2-experience-arrow">↓</div>
            <div className="csv2-experience-card csv2-experience-card-two"><div><Scissors size={16}/> CENAS</div><div className="csv2-experience-scene-line"><span/><span/><span/></div><p>Roteiro visual + prévia em movimento</p></div>
            <div className="csv2-experience-arrow">↓</div>
            <div className="csv2-experience-card csv2-experience-card-three"><div><Download size={16}/> ARQUIVO</div><div className="csv2-experience-export"><Film size={24}/> Vídeo exportado <Check size={18}/></div></div>
            <p className="csv2-experience-art-caption">Fluxo ilustrado · O resultado depende do modelo, navegador e das cenas.</p>
          </div>
        </div>
      </section>

      <section className="csv2-studio-section csv2-container">
        <div className="csv2-studio-head">
          <div><p className="csv2-kicker"><span className="csv2-kicker-line"/> CONSTRUINDO COM TRANSPARÊNCIA</p>
            <h2>Um produto real. <span>Em evolução.</span></h2></div>
          <p>Queremos que você saiba o que já existe e o que ainda estamos melhorando.</p>
        </div>
        <div className="csv2-status-grid">
          <div className="csv2-status-item"><span className="csv2-status-bullet csv2-status-ready"/><b>Editor 2D</b><p>Roteiro, prévia e exportação já implementados; seguimos aprimorando a qualidade.</p></div>
          <div className="csv2-status-item"><span className="csv2-status-bullet csv2-status-work"/><b>Animação 3D</b><p>Modos experimentais em desenvolvimento e avaliação visual.</p></div>
          <div className="csv2-status-item"><span className="csv2-status-bullet csv2-status-work"/><b>Pagamentos e planos</b><p>Em testes. Preços e condições serão apresentados após a homologação.</p></div>
        </div>
      </section>

      <section className="csv2-launch" id="lancamento">
        <div className="csv2-container csv2-launch-layout">
          <div className="csv2-launch-copy">
            <div className="csv2-launch-flag"><Clock3 size={17}/> ANOTE A DATA</div>
            <h2>O começo está <span>mais perto.</span></h2>
            <p>Estamos trabalhando para abrir a próxima fase do CrieSeuVideo em <strong>5 de dezembro de 2026, às 19h</strong> (horário de Brasília).</p>
            <small>Data prevista e sujeita aos testes finais de qualidade, login e pagamentos.</small>
          </div>
          <div className="csv2-launch-timer">
            <p>CONTAGEM REGRESSIVA</p>
            <Clock/>
          </div>
        </div>
      </section>

      <section className="csv2-final-cta csv2-container" id="grupo">
        <div className="csv2-final-copy">
          <p className="csv2-kicker"><span className="csv2-kicker-line"/> VOCÊ JÁ CONHECEU A IDEIA</p>
          <h2>Quer acompanhar <span>o lançamento de perto?</span></h2>
          <p>Entre no grupo para receber as atualizações do produto, demonstrações, o anúncio dos planos e a confirmação da abertura.</p>
          <WhatsAppLink>Entrar no grupo de lançamento</WhatsAppLink>
          <p className="csv2-privacy">O grupo é gratuito. No WhatsApp, seu número e nome de perfil podem ficar visíveis aos outros participantes.</p>
        </div>
        <div className="csv2-final-icon"><Users size={108} strokeWidth={1.1}/><span>CRIESEUVIDEO · COMUNIDADE</span></div>
      </section>
    </main>

    <footer className="csv2-footer csv2-container">
      <Brand/>
      <span>CrieSeuVideo © 2026 · Tecnologia em desenvolvimento · Sem promessa de ganhos financeiros.</span>
      <a href="/estudio">Acessar estúdio <ArrowUpRight size={15}/></a>
    </footer>
    <div className="csv2-mobile-bar"><a href="#grupo" className="csv2-button csv2-button-red">
      Conhecer o grupo de lançamento <ArrowRight size={17}/>
    </a></div>
  </div>;
}
