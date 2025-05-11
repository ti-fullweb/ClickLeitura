import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

// Exemplo de uso:
// storage.set('user.name', 'Richard');
// const userName = storage.getString('user.name');
// storage.delete('user.name');
