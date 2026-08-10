export const colors = {
  canvas: '#f4f6f2',
  surface: '#ffffff',
  ink: '#17211d',
  inkMuted: '#aebbb5',
  inkBorder: '#3a4741',
  muted: '#65716c',
  faint: '#89938f',
  border: '#dfe5e1',
  blue: '#2563eb',
  blueSoft: '#e7efff',
  green: '#16865b',
  orange: '#d66b1f',
} as const;

export type ThemeColors = { [Key in keyof typeof colors]: string };

export const darkColors: ThemeColors = {
  canvas:'#0f1512',surface:'#17211d',ink:'#f5f7f6',inkMuted:'#53625b',inkBorder:'#b5c1bb',muted:'#b3beb8',faint:'#84918a',border:'#34413b',blue:'#6f9cff',blueSoft:'#21345e',green:'#51c895',orange:'#f4a261',
};
