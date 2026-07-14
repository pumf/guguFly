export const TASK_COLORS = [
  { id: 'red',    label: '红', value: '#e74c3c' },
  { id: 'orange', label: '橙', value: '#ff9560' },
  { id: 'yellow', label: '黄', value: '#f1c40f' },
  { id: 'green',  label: '绿', value: '#62bf82' },
  { id: 'cyan',   label: '青', value: '#4ecdc4' },
  { id: 'blue',   label: '蓝', value: '#2d7ff9' },
  { id: 'purple', label: '紫', value: '#9775fa' },
  { id: 'pink',   label: '粉', value: '#f783ac' },
];

export const TASK_COLOR_VALUES = Object.fromEntries(TASK_COLORS.map(c => [c.id, c.value]));
export const TASK_COLOR_IDS = TASK_COLORS.map(c => c.id);

export const TASK_TYPE_COLORS = {
  alarm:      '#2d7ff9',
  countdown:  '#ff9560',
  holiday:    '#e74c3c',
  anniversary:'#f783ac',
};
