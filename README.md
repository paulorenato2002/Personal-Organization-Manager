# Personal Organization Manager

Organizador pessoal leve: demandas por setor e cliente, rotinas, compromissos, agenda e metas diárias com grade de desempenho. Funciona direto do disco, sem instalar nada e sem internet. Os dados ficam só no seu computador.

## Como abrir

1. Baixe ou clone este repositório.
2. Abra `index.html` no Chrome ou no Edge.
3. Na primeira abertura, informe seu nome, escolha começar com o modelo pronto ou vazio e selecione a pasta dos seus dados.

Dica: salve o `index.html` nos favoritos para abrir com um clique.

## Adicionar demandas

No campo de cada coluna, escreva e dê Enter:

```text
ACME - enviar boletos
```

O texto antes de ` - ` vira a etiqueta do cliente. Sem esse separador, a demanda fica sem cliente. Ao focar o campo de demanda, aparece a data de entrega, que começa em hoje. Clique na demanda para ver os detalhes.

Na aba Clientes, cada cliente tem sua página, com as rotinas e demandas dele e campos para adicionar novas.

## Onde os dados ficam

| Local | Como funciona |
|---|---|
| Navegador (IndexedDB) | Salvamento principal, automático |
| Pasta dos seus dados | Cópia automática de tudo em `organizador-dados.json`, na pasta que você escolher (Chrome e Edge) |
| Backup manual | Exportar e Importar, em Ajustes |

**Atenção:** limpar os dados do navegador apaga o salvamento principal. Mantenha uma pasta escolhida ou exporte backups.

Ao reabrir o app, o navegador pode pedir um clique em "Liberar pasta" para voltar a gravar o arquivo.

### Levar para outro computador

1. Copie a pasta dos seus dados para o computador novo.
2. Abra o app e selecione essa pasta. Ele pergunta se você quer usar os dados dela.

Sem a pasta, use Exportar no computador atual e Importar no novo, em Ajustes.

## Metas

Na aba Metas, cada meta é marcada no dia: sim ou não, quantidade (ex.: 3 L de água, somando 500 ml por clique) ou lista (ex.: refeições). A grade de desempenho mostra os últimos 30 dias:

| Cor | Significado |
|---|---|
| Verde | Cumpriu 100% da meta |
| Amarelo | Fez uma parte |
| Vermelho | Não fez |

Clique em um quadradinho para abrir o dia e corrigir.

## Testes

Precisa do Node.js 22 ou mais novo.

```bash
node --test "tests/*.test.js"
```

## Licenças

As letras em `fonts/` são distribuídas sob a SIL Open Font License. Veja os arquivos `LICENSE-*` na pasta.
