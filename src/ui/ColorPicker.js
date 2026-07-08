import { TASK_COLORS, TASK_COLOR_VALUES } from '../tasks/TaskColors.js';
import { t } from '../i18n/index.js';

let editColorPickerEl;
let selectedEditColor = null;

export function initColorPicker(ctx) {
  editColorPickerEl = ctx.editColorPicker;
  if (!editColorPickerEl) return;
  TASK_COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button'; sw.className = 'color-swatch';
    sw.dataset.color = c.id; sw.title = t(`color.${c.id}`);
    sw.style.background = c.value;
    sw.addEventListener('click', () => selectColor(c.id));
    editColorPickerEl.appendChild(sw);
  });
  applyColorPickerSelection();
}

export function getSelectedEditColor() {
  return selectedEditColor;
}

export function selectColor(colorId) {
  if (colorId && !TASK_COLOR_VALUES[colorId]) selectedEditColor = null;
  else selectedEditColor = colorId || null;
  applyColorPickerSelection();
}

function applyColorPickerSelection() {
  if (!editColorPickerEl) return;
  editColorPickerEl.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('is-active', (swatch.dataset.color || '') === (selectedEditColor || ''));
  });
}
