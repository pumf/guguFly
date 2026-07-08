import { t } from '../i18n/index.js';

let nextId = 1;

export function setNextId(id) {
  nextId = id;
}

export function getNextId() {
  return nextId;
}

export function createBaseTask(type) {
  return {
    id: nextId++,
    type,
    label: '',
    msg: '',
    enabled: true,
    flightMode: 'once',
    loopCount: 3,
    loopInterval: 5,
    intervalCount: 10,
    postFlightAction: 'none',
    postFlightAppPath: '',
    postFlightUrl: '',
    postFlightFolder: '',
    postFlightScript: '',
    postFlightVideoFile: 'cat.mov',
    postFlightVideoDuration: 30,
    postFlightVideoSpeed: 1,
    postFlightVideoScale: 1,
    group: '',
    imageData: null,
    useImage: false,
    color: null,
  };
}

export function createAlarmTask() {
  return {
    ...createBaseTask('alarm'),
    hour: 12,
    minute: 0,
    repeat: [],
    _lastTriggeredDate: null,
  };
}

export function createCountdownTask() {
  return {
    ...createBaseTask('countdown'),
    duration: 1800,
    _remaining: 1800,
    _status: 'idle',
    _timer: null,
  };
}

export function createHolidayTask() {
  return {
    ...createBaseTask('holiday'),
    label: '元旦',
    holidayKey: 'new_year',
    month: 1,
    day: 1,
    hour: 9,
    minute: 0,
    lunar: false,
    _lastTriggeredDate: null,
  };
}

export function createAnniversaryTask() {
  return {
    ...createBaseTask('anniversary'),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    hour: 9,
    minute: 0,
    lunar: false,
    _lastTriggeredDate: null,
  };
}

export function getTaskTypeMeta(task) {
  const meta = {
    alarm: { labelKey: 'task.type.alarm', className: 'alarm' },
    countdown: { labelKey: 'task.type.countdown', className: 'countdown' },
    holiday: { labelKey: 'task.type.holiday', className: 'holiday' },
    anniversary: { labelKey: 'task.type.anniversary', className: 'anniversary' },
  };
  const entry = meta[task.type] || { labelKey: 'task.type.default', className: 'generic' };
  return { label: t(entry.labelKey), className: entry.className };
}
