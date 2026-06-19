document.addEventListener('DOMContentLoaded', () => {
  // Header blur on scroll
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('glass-panel');
      header.style.borderTop = 'none';
      header.style.borderLeft = 'none';
      header.style.borderRight = 'none';
      header.style.borderRadius = '0';
      header.style.background = 'rgba(3, 3, 3, 0.8)';
    } else {
      header.classList.remove('glass-panel');
      header.style.background = 'transparent';
    }
  });

  // Fade-in animation observer
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  const animateItems = document.querySelectorAll('.glass-panel');
  animateItems.forEach(item => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(20px)';
    item.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    observer.observe(item);
  });

  // Inject visible class styles dynamically
  const style = document.createElement('style');
  style.innerHTML = `
    .glass-panel.visible {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
});
