# Personal Organization Manager

Organizador pessoal leve: demandas por setor e cliente, rotinas, compromissos, agenda e metas diárias com grade de desempenho. Funciona direto do disco, sem instalar nada e sem internet. Os dados ficam só no seu computador. Este repositório também traz o **Caderno**, um planner híbrido de papel e tela, na pasta [`esboco-planner/`](esboco-planner/) (veja a seção Caderno, mais abaixo).

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

## Caderno: planner híbrido de papel e tela

A pasta [`esboco-planner/`](esboco-planner/) tem o **Caderno**: planeje na tela (ano, mês, semana e dia), imprima a folha do dia em A4 e escreva a caneta. Tem lembretes fixos (água, rotinas em lista), quadro de constância dos hábitos e objetivos em bolhas. É um esboço e funciona sozinho, sem depender do organizador acima.

1. Baixe este repositório (**Code**, depois **Download ZIP**) e descompacte, ou clone com o git.
2. Abra `esboco-planner/index.html` no Chrome ou no Edge.

Não instala nada, funciona sem internet e os dados ficam no seu navegador (faça cópias em Ajustes, Seus dados). Detalhes no [LEIA-ME do Caderno](esboco-planner/LEIA-ME.md). Testes: `node --test "esboco-planner/tests/*.test.js"`.

## Licenças

O código deste repositório é distribuído sob a licença MIT (arquivo [`LICENSE`](LICENSE)). As letras em `fonts/` e em `esboco-planner/fonts/` são distribuídas sob a SIL Open Font License; veja os arquivos `LICENSE-*` em cada pasta.
