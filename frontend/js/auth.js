let isLogin = true;

const authForm = document.getElementById('auth-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const title = document.getElementById('auth-title');
const toggleBtn = document.getElementById('toggle-auth-btn');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-msg');

toggleBtn.addEventListener('click', () => {
  isLogin = !isLogin;
  if (isLogin) {
    title.innerText = 'Student Login';
    nameInput.classList.add('hidden');
    nameInput.required = false;
    submitBtn.innerText = 'Login';
    toggleBtn.innerText = "Don't have an account? Register";
  } else {
    title.innerText = 'Student Registration';
    nameInput.classList.remove('hidden');
    nameInput.required = true;
    submitBtn.innerText = 'Register';
    toggleBtn.innerText = "Already have an account? Login";
  }
  errorMsg.classList.add('hidden');
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value;
  const password = passwordInput.value;
  const name = nameInput.value;

  submitBtn.disabled = true;
  submitBtn.innerText = 'Please wait...';

  try {
    let data;
    if (isLogin) {
      data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } else {
      data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
    }

    // Save token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));

    // Redirect based on role
    if (data.isAdmin) {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    errorMsg.innerText = error.message;
    errorMsg.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = isLogin ? 'Login' : 'Register';
  }
});

// Check if already logged in
const checkAuth = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    const user = JSON.parse(userStr);
    if (user.isAdmin) window.location.href = 'admin.html';
    else window.location.href = 'dashboard.html';
  }
};

checkAuth();
