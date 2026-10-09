/** Carrega o arquivo .env (se existir) antes de qualquer outro módulo ler process.env. */
try {
  process.loadEnvFile()
} catch {
  // sem .env: usa só as variáveis do ambiente
}
