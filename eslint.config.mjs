import next from 'eslint-config-next';

export default [
  ...next,
  {
    rules: {
      '@next/next/no-server-import-in-page': 'off',
      // react-hooks v7 新增的严格规则，捕获既有代码模式，暂不阻断
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
