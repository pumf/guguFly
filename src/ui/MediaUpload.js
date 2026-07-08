import { t } from '../i18n/index.js';
import { validateUpload } from './ModalController.js';

const VALID_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);
const VALID_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg']);
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

export function initMediaUpload(ctx) {
  const {
    imageBtn, imageInput, clearImageBtn, imagePreview, useImageCheckbox,
    customizeImageBtn, imageCollapse,
    editImageBtn, editImageInput, editClearImageBtn, editImagePreview, editUseImageCheckbox,
    soundBtn, soundInput, clearSoundBtn, useSoundCheckbox,
    customizeSoundBtn, soundCollapse,
    updateTitleLogo, setCustomImageData, persistSetting, showToast,
    buildCustomAudioObjectUrl, syncAudioObjectUrlTo, updateSoundMeta,
    setCustomAudioData, setCustomAudioObjectUrl,
    stopPreviewAudio, resetAudioPreview, revokeCustomAudioObjectUrl,
    unlockAudioIfNeeded, validateCustomAudioPreview,
    customImageDataRef, editImageDataRef, customAudioDataRef, customAudioNameRef,
  } = ctx;

  const toggleImageCollapse = (open) => {
    if (!customizeImageBtn || !imageCollapse) return;
    const shouldOpen = open ?? imageCollapse.classList.contains('hidden');
    imageCollapse.classList.toggle('hidden', !shouldOpen);
    customizeImageBtn.classList.toggle('is-open', shouldOpen);
    customizeImageBtn.textContent = shouldOpen ? t('media.collapse') : t('media.expand_image');
  };
  if (customizeImageBtn) {
    customizeImageBtn.addEventListener('click', () => toggleImageCollapse());
  }

  const toggleSoundCollapse = (open) => {
    if (!customizeSoundBtn || !soundCollapse) return;
    const shouldOpen = open ?? soundCollapse.classList.contains('hidden');
    soundCollapse.classList.toggle('hidden', !shouldOpen);
    customizeSoundBtn.classList.toggle('is-open', shouldOpen);
    customizeSoundBtn.textContent = shouldOpen ? t('media.collapse') : t('media.expand_sound');
  };
  if (customizeSoundBtn) {
    customizeSoundBtn.addEventListener('click', () => toggleSoundCollapse());
  }

  imageBtn.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (!validateUpload(file, VALID_IMAGE_TYPES, MAX_IMAGE_SIZE, t('error.image'), imageBtn, true)) { imageInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      customImageDataRef.set(data);
      clearImageBtn.classList.remove('hidden');
      imagePreview.src = data; imagePreview.classList.remove('hidden');
      useImageCheckbox.closest('.img-toggle').classList.remove('hidden');
      useImageCheckbox.checked = true;
      toggleImageCollapse(true);
      updateTitleLogo();
      setCustomImageData(data);
      persistSetting('customImage', data);
      persistSetting('useImage', true);
    };
    reader.readAsDataURL(file);
  });
  clearImageBtn.addEventListener('click', () => {
    customImageDataRef.set('');
    clearImageBtn.classList.add('hidden');
    imagePreview.classList.add('hidden'); imagePreview.src = '';
    useImageCheckbox.closest('.img-toggle').classList.add('hidden');
    useImageCheckbox.checked = false;
    imageInput.value = '';
    toggleImageCollapse(false);
    updateTitleLogo();
    setCustomImageData('');
    persistSetting('customImage', '');
    persistSetting('useImage', false);
  });

  if (editImageBtn) editImageBtn.addEventListener('click', () => { if (editImageInput) editImageInput.click(); });
  if (editImageInput) {
    editImageInput.addEventListener('change', () => {
      const file = editImageInput.files[0];
      if (!file) return;
      if (!validateUpload(file, VALID_IMAGE_TYPES, MAX_IMAGE_SIZE, t('error.image'), editImageBtn, true)) { editImageInput.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        editImageDataRef.set(data);
        if (editImagePreview) { editImagePreview.src = data; editImagePreview.classList.remove('hidden'); }
        if (editClearImageBtn) editClearImageBtn.hidden = false;
        if (editUseImageCheckbox) editUseImageCheckbox.checked = true;
      };
      reader.readAsDataURL(file);
    });
  }
  if (editClearImageBtn) {
    editClearImageBtn.addEventListener('click', () => {
      editImageDataRef.set('');
      if (editImagePreview) { editImagePreview.src = ''; editImagePreview.classList.add('hidden'); }
      editClearImageBtn.hidden = true;
      if (editUseImageCheckbox) editUseImageCheckbox.checked = false;
      if (editImageInput) editImageInput.value = '';
    });
  }

  soundBtn.addEventListener('click', () => soundInput.click());
  soundInput.addEventListener('change', () => {
    const file = soundInput.files[0];
    if (!file) return;
    if (!validateUpload(file, VALID_AUDIO_TYPES, MAX_AUDIO_SIZE, t('error.audio'), soundBtn, false)) { soundInput.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target.result;
      const audioName = file.name || '';
      customAudioDataRef.set(audioData);
      customAudioNameRef.set(audioName);
      const audioUrl = buildCustomAudioObjectUrl();
      syncAudioObjectUrlTo(audioUrl);
      clearSoundBtn.classList.remove('hidden');
      useSoundCheckbox.checked = true;
      toggleSoundCollapse(true);
      updateSoundMeta();
      setCustomAudioData(audioData);
      persistSetting('customAudio', audioData);
      persistSetting('customAudioName', audioName);
      persistSetting('useSound', true);
      showToast(t('toast.media_added', { name: audioName }));
      void unlockAudioIfNeeded();
      void validateCustomAudioPreview();
    };
    reader.readAsDataURL(file);
  });
  clearSoundBtn.addEventListener('click', () => {
    stopPreviewAudio(); resetAudioPreview();
    revokeCustomAudioObjectUrl();
    customAudioDataRef.set(''); customAudioNameRef.set('');
    clearSoundBtn.classList.add('hidden');
    useSoundCheckbox.checked = false;
    soundInput.value = '';
    toggleSoundCollapse(false);
    updateSoundMeta();
    setCustomAudioData(''); setCustomAudioObjectUrl('');
    syncAudioObjectUrlTo('');
    persistSetting('customAudio', ''); persistSetting('customAudioName', ''); persistSetting('useSound', false);
  });
}
