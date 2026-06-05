const links = document.querySelectorAll('.nav-link');

for (const link of links) {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(item => item.classList.remove('is-active'));
    link.classList.add('is-active');
  });
}
