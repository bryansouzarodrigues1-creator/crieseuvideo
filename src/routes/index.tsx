import { createFileRoute } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, Film, LockKeyhole, Play, Sparkles, Users, WandSparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import '../launch.css';

const GROUP_URL = 'https://chat.whatsapp.com/Jba8u5eY9heEw9fGj9rnCg?s=cl&p=a&iam=2';
const LAUNCH_AT = new Date('2026-12-05T19:00:00-03:00').getTime();

function partsUntil(now: number) {
  const ms = Math.max(0, LAUNCH_AT - now);
  const seconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    finished: ms === 0,
  };
}

export const Route = createFileRoute('/')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'CrieSeuVideo | Lançamento em 5 de dezembro' },
    { name:'description', content:'Crie vídeos animados com IA. Entre no grupo de lançamento do CrieSeuVideo e acompanhe as novidades até 5 de dezembro.' },
    { property:'og:title', content:'CrieSeuVideo — lançamento previsto para 5/12' },
    { property:'og:description', content:'Participe do grupo de lançamento e descubra como produzir vídeos animados com IA.' },
    { property:'og:type', content:'website' },
    { name:'twitter:card', content:'summary_large_image' },
  ] }),
  component: LaunchLanding,
});

function GroupButton({secondary=false, children}: {secondary?:boolean,children:ReactNode}) {
  return <a
    href={GROUP_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={secondary ? 'csv-launch-btn csv-launch-btn-secondary' : 'csv-launch-btn csv-launch-btn-primary'}
  >
    <Users size={19} strokeWidth={2.3} aria-hidden="true" />
    <span>{children}</span>
    <ArrowUpRight size={17} strokeWidth={2.3} aria-hidden="true"/>
  </a>;
}

function Countdown() {
  const [time,setTime] = useState<ReturnType<typeof partsUntil> | null>(null);
  useEffect(() => {
    const tick = () => setTime(partsUntil(Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const vals = [
    { label:'dias', value: time?.days ?? 0 },
    { label:'horas', value: time?.hours ?? 0 },
    { label:'min', value: time?.minutes ?? 0 },
    { label:'seg', value: time?.seconds ?? 0 },
  ];
  return <div className="csv-launch-countdown" aria-label="Tempo até o lançamento previsto">
    {vals.map((item) => <div className="csv-launch-count-unit" key={item.label}>
      <strong>{time ? String(item.value).padStart(2,'0') : '--'}</strong>
      <span>{item.label}</span>
    </div>)}
  </div>;
}

function LaunchLanding() {
  const [signedIn,setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({data}) => {
      if (active) setSignedIn(Boolean(data.user));
    }).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_event,session) => {
      if (active) setSignedIn(Boolean(session?.user));
    });
    return () => { active=false; data.subscription.unsubscribe(); };
  }, []);

  return <div className="csv-launch">
    <header className="csv-launch-header">
      <a href="/" className="csv-launch-logo" aria-label="CrieSeuVideo início">
        <span className="csv-launch-logo-icon"><Film size={20} strokeWidth={2.7}/></span>
        <span>CrieSeu<span className="csv-launch-brand-blue">Video</span></span>
      </a>
      <div className="csv-launch-header-right">
        <span className="csv-launch-header-tag"><span className="csv-launch-live-dot"/> LANÇAMENTO EM BREVE</span>
        <a className="csv-launch-login" href="/estudio">
          <LockKeyhole size={15}/> {signedIn ? 'Abrir estúdio' : 'Entrar com Google'} <ArrowRight size={16}/>
        </a>
      </div>
    </header>

    <main>
      <section className="csv-launch-hero">
        <div className="csv-launch-grid-halo"/>
        <div className="csv-launch-container csv-launch-hero-layout">
          <div className="csv-launch-hero-copy">
            <div className="csv-launch-eyebrow"><Sparkles size={14}/> PARA QUEM QUER CRIAR, NÃO SÓ ASSISTIR</div>
            <h1>Sua ideia pode virar um <em>vídeo animado.</em></h1>
            <p className="csv-launch-lead">
              Estamos preparando uma plataforma para transformar temas em vídeos animados com inteligência artificial.
              Aprenda o processo, crie conteúdo original e descubra formas de oferecer essa habilidade na internet.
            </p>
            <div className="csv-launch-actions">
              <GroupButton>Entrar no grupo de lançamento</GroupButton>
              <a href="/estudio" className="csv-launch-btn csv-launch-btn-outline">
                <LockKeyhole size={18}/> {signedIn ? 'Acessar meu estúdio' : 'Criar minha conta'} <ArrowRight size={17}/>
              </a>
            </div>
            <p className="csv-launch-footnote"><Check size={15}/> Grupo gratuito · Avisos de lançamento · Sem promessa de renda garantida</p>
          </div>

          <div className="csv-launch-visual" aria-label="Prévia conceitual do fluxo de criação">
            <div className="csv-launch-preview">
              <div className="csv-launch-preview-top">
                <span><span className="csv-launch-mini-dot"/> ESTÚDIO CRIATIVO</span>
                <span>PRÉVIA</span>
              </div>
              <div className="csv-launch-preview-canvas">
                <div className="csv-launch-orbit csv-launch-orbit-one"/>
                <div className="csv-launch-orbit csv-launch-orbit-two"/>
                <div className="csv-launch-preview-object"><WandSparkles size={48} strokeWidth={1.8}/></div>
                <div className="csv-launch-floating-label csv-launch-label-one"><Sparkles size={15}/> UMA IDEIA</div>
                <div className="csv-launch-floating-label csv-launch-label-two"><Play size={14} fill="currentColor"/> UM VÍDEO</div>
                <div className="csv-launch-canvas-bottom"><span>ANIMAÇÕES POR IA</span><span>9:16</span></div>
              </div>
              <div className="csv-launch-preview-footer"><span><span className="csv-launch-steps-dot"/> Roteiro</span><span><span className="csv-launch-steps-dot"/> Cenas</span><span><span className="csv-launch-steps-dot"/> Exportação</span></div>
            </div>
            <div className="csv-launch-overlay-chip"><Clock3 size={16}/> A CONTAGEM COMEÇOU</div>
          </div>
        </div>
      </section>

      <section className="csv-launch-date-band" id="lancamento">
        <div className="csv-launch-container csv-launch-date-inner">
          <div className="csv-launch-date-desc">
            <span className="csv-launch-small-label"><CalendarDays size={16}/> NOSSO PRÓXIMO MARCO</span>
            <h2>Lançamento previsto<br/><strong>05 DE DEZEMBRO</strong></h2>
            <p>Sábado, às 19h · Horário de Brasília</p>
          </div>
          <div className="csv-launch-count-container">
            <p className="csv-launch-count-label">CONTAGEM REGRESSIVA</p>
            <Countdown/>
            <span className="csv-launch-time-note">Meta sujeita a ajustes conforme os testes finais.</span>
          </div>
        </div>
      </section>

      <section className="csv-launch-steps csv-launch-container">
        <div className="csv-launch-section-kicker">UM CAMINHO MAIS SIMPLES</div>
        <h2>Da ideia ao seu primeiro vídeo</h2>
        <div className="csv-launch-feature-grid">
          <div className="csv-launch-feature">
            <div className="csv-launch-feature-icon"><Sparkles size={22}/></div>
            <span>01</span>
            <h3>Escolha o tema</h3>
            <p>Comece com uma curiosidade, uma história ou um problema que você quer explicar.</p>
          </div>
          <div className="csv-launch-feature">
            <div className="csv-launch-feature-icon"><WandSparkles size={22}/></div>
            <span>02</span>
            <h3>Crie com IA</h3>
            <p>Monte o roteiro e as cenas animadas com o auxílio das ferramentas do estúdio.</p>
          </div>
          <div className="csv-launch-feature">
            <div className="csv-launch-feature-icon"><Film size={22}/></div>
            <span>03</span>
            <h3>Publique ou ofereça</h3>
            <p>Use vídeos originais nas suas redes ou desenvolva trabalhos para clientes.</p>
          </div>
        </div>
        <p className="csv-launch-preview-disclaimer">Fluxo planejado para o lançamento. Alguns recursos seguem em desenvolvimento e homologação.</p>
      </section>

      <section className="csv-launch-join csv-launch-container">
        <div>
          <div className="csv-launch-section-kicker">A COMUNIDADE COMEÇA ANTES</div>
          <h2>Entre agora no grupo VIP de lançamento.</h2>
          <p>Vamos compartilhar a data, atualizações do motor, demonstrações e detalhes dos planos quando estiverem definidos.</p>
          <div className="csv-launch-join-actions"><GroupButton>Participar no WhatsApp</GroupButton></div>
          <p className="csv-launch-group-privacy">Ao entrar em um grupo do WhatsApp, seu número e perfil podem ficar visíveis aos demais participantes.</p>
        </div>
        <div className="csv-launch-join-illustration"><Users size={70} strokeWidth={1.1}/><span>JUNTOS DESDE O DIA 1</span></div>
      </section>
    </main>

    <footer className="csv-launch-footer csv-launch-container">
      <div className="csv-launch-logo"><span className="csv-launch-logo-icon"><Film size={16}/></span> CrieSeu<span className="csv-launch-brand-blue">Video</span></div>
      <p>Plataforma em desenvolvimento · 2026 · Vídeos com IA, sem promessas de ganhos financeiros.</p>
      <a href="/estudio">Acessar conta <ArrowRight size={14}/></a>
    </footer>

    <div className="csv-launch-mobile-sticky"><GroupButton>Entrar no grupo de lançamento</GroupButton></div>
  </div>;
}
