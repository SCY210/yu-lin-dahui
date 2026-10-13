import './cultivation-ornament.css';

/** Original feather, court and cloud emblem; decorative, so it never competes with account controls. */
export default function CultivationOrnament({variant='compact'}:{variant?:'compact'|'hero'}) {
  return <div className={'cultivation-ornament cultivation-ornament-'+variant+(variant==='compact'?' brand-mark':'')} aria-hidden="true">
    <img src={variant==='compact'?'/yulin-mark.svg':'/feather-court-seal.svg'} width={variant==='compact'?128:240} height={variant==='compact'?128:240} alt=""/>
    {variant === 'hero' && <span className="cultivation-seal-caption">羽林 · 同修</span>}
  </div>;
}
