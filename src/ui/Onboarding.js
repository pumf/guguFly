import { t, setLanguage } from '../i18n/index.js';

let overlayEl;
let currentStep = 0;
let onCompleteFn = null;
let applyThemeFn = null;
let openNewModalFn = null;
let previewFlightFn = null;
let persistSettingFn = null;

const STORAGE_KEY = 'onboarding_completed';

export function initOnboarding(ctx) {
  onCompleteFn = ctx.onComplete;
  applyThemeFn = ctx.applyTheme;
  openNewModalFn = ctx.openNewModal;
  previewFlightFn = ctx.previewFlight;
  persistSettingFn = ctx.persistSetting;
}

export function checkAndShowOnboarding() {
  const completed = localStorage.getItem(STORAGE_KEY);
  if (completed) return false;
  showOnboarding();
  return true;
}

export function showOnboarding() {
  overlayEl = document.getElementById('onboardingOverlay');
  if (!overlayEl) return;
  currentStep = 0;
  renderStep();
  overlayEl.classList.remove('hidden');
}

function hideOnboarding() {
  if (overlayEl) {
    overlayEl.classList.add('hidden');
  }
  localStorage.setItem(STORAGE_KEY, 'true');
  if (onCompleteFn) onCompleteFn();
}

function renderStep() {
  const contentEl = document.getElementById('onboardingContent');
  if (!contentEl) return;

  const steps = [
    {
      icon: '🎨',
      title: t('onboarding.step1_title'),
      desc: t('onboarding.step1_desc'),
      content: `
        <div class="onboarding-options">
          <div class="onboarding-option-group">
            <label class="onboarding-label">${t('onboarding.theme')}</label>
            <div class="onboarding-theme-btns">
              <button class="onboarding-theme-btn active" data-theme="light">${t('settings.theme_light')}</button>
              <button class="onboarding-theme-btn" data-theme="dark">${t('settings.theme_dark')}</button>
              <button class="onboarding-theme-btn" data-theme="system">${t('settings.theme_system')}</button>
            </div>
          </div>
          <div class="onboarding-option-group">
            <label class="onboarding-label">${t('onboarding.language')}</label>
            <div class="onboarding-theme-btns">
              <button class="onboarding-lang-btn active" data-lang="zh-CN">${t('settings.language_zh')}</button>
              <button class="onboarding-lang-btn" data-lang="en">${t('settings.language_en')}</button>
            </div>
          </div>
        </div>
      `
    },
    {
      icon: '📝',
      title: t('onboarding.step2_title'),
      desc: t('onboarding.step2_desc'),
      content: `
        <div class="onboarding-templates">
          <button class="onboarding-template-btn" data-type="alarm" data-time="09:00">
            <span class="onboarding-template-icon">⏰</span>
            <span class="onboarding-template-text">${t('onboarding.template_alarm')}</span>
          </button>
          <button class="onboarding-template-btn" data-type="countdown" data-time="25">
            <span class="onboarding-template-icon">⏱</span>
            <span class="onboarding-template-text">${t('onboarding.template_countdown')}</span>
          </button>
        </div>
      `
    },
    {
      icon: '✈️',
      title: t('onboarding.step3_title'),
      desc: t('onboarding.step3_desc'),
      content: `
        <div class="onboarding-preview">
          <button class="onboarding-preview-btn" id="onboardingPreviewBtn">
            <span class="onboarding-preview-icon">🛫</span>
            <span>${t('onboarding.preview_btn')}</span>
          </button>
        </div>
      `
    }
  ];

  const step = steps[currentStep];
  contentEl.innerHTML = `
    <div class="onboarding-step">
      <div class="onboarding-step-header">
        <span class="onboarding-step-icon">${step.icon}</span>
        <h3 class="onboarding-step-title">${step.title}</h3>
        <p class="onboarding-step-desc">${step.desc}</p>
      </div>
      <div class="onboarding-step-content">
        ${step.content}
      </div>
    </div>
    <div class="onboarding-progress">
      ${steps.map((_, i) => `<span class="onboarding-dot ${i === currentStep ? 'active' : ''}"></span>`).join('')}
    </div>
    <div class="onboarding-actions">
      <button class="onboarding-btn onboarding-btn--skip" id="onboardingSkipBtn">${t('onboarding.skip')}</button>
      <button class="onboarding-btn onboarding-btn--next" id="onboardingNextBtn">
        ${currentStep === steps.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
      </button>
    </div>
  `;

  bindStepEvents();
}

function bindStepEvents() {
  const skipBtn = document.getElementById('onboardingSkipBtn');
  const nextBtn = document.getElementById('onboardingNextBtn');

  skipBtn?.addEventListener('click', hideOnboarding);
  nextBtn?.addEventListener('click', () => {
    if (currentStep < 2) {
      currentStep++;
      renderStep();
    } else {
      hideOnboarding();
    }
  });

  if (currentStep === 0) {
    document.querySelectorAll('.onboarding-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.onboarding-theme-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        if (applyThemeFn) applyThemeFn(theme);
        if (persistSettingFn) persistSettingFn('theme', theme);
      });
    });

    document.querySelectorAll('.onboarding-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.onboarding-lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        setLanguage(lang, { persist: true });
        if (persistSettingFn) persistSettingFn('language', lang);
        renderStep();
      });
    });
  }

  if (currentStep === 1) {
    document.querySelectorAll('.onboarding-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (openNewModalFn) openNewModalFn();
        hideOnboarding();
      });
    });
  }

  if (currentStep === 2) {
    const previewBtn = document.getElementById('onboardingPreviewBtn');
    previewBtn?.addEventListener('click', () => {
      if (previewFlightFn) previewFlightFn();
    });
  }
}
