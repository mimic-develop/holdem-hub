/**
 * useSettings — Zustand settings-store의 thin wrapper.
 * 앱 내 어디서든 동일 settings 인스턴스를 공유하며 API 호출은 init() 시 1회만 발생.
 */
export { useSettingsStore as useSettings } from '../store/settings-store';
