function initHeaderScrollStandalone(){
  const update = () => {
    const progress = Math.min(Math.max(window.scrollY / 240, 0), 1);
    document.documentElement.style.setProperty('--header-darkness', progress.toFixed(3));
    document.body.classList.toggle('header-scrolled', progress > 0.02);
  };
  update();
  window.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update);
}
document.addEventListener('DOMContentLoaded', initHeaderScrollStandalone);
