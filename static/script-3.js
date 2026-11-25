document.querySelectorAll('.password-eye').forEach(button => {
  const field = document.getElementById(button.getAttribute('aria-controls'));
  button.addEventListener('click', () => {
    const reveal = field.type === 'password';
    field.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
  });
});
