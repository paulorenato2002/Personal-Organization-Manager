# Caderno

Planner híbrido de papel e tela: planeje na tela (ano, mês, semana e dia), imprima a folha do dia em A4 e escreva a caneta. Funciona direto do disco, sem instalar nada e sem internet. Os dados ficam só no seu navegador.

É um esboço: já dá para usar, mas muda bastante de uma versão para outra. Testado no Chrome e no Edge; a impressão foi testada na visualização e em PDF, não em impressora de verdade.

## Como usar

1. Baixe este repositório (botão **Code**, depois **Download ZIP**) e descompacte, ou clone com o git.
2. Dê dois cliques em `index.html`. Ele abre no Chrome ou no Edge.
3. Dica: salve a página nos favoritos para abrir com um clique.

## O que tem

- **Dia:** a folha do dia, com hora, categoria e blocos de trabalho detalhados. Imprime em A4 com linhas em branco para anotar a caneta.
- **Semana, Mês e Ano:** de 2026 a 2040, com feriados nacionais, foco de cada período e filtro por categoria.
- **Lembretes fixos:** o que se marca todo dia sem hora (água, refeições, rotinas da manhã e da noite em lista, treino). Saem no papel como quadradinhos para riscar.
- **Constância:** quadro de quadradinhos no estilo do gráfico de contribuições do GitHub, para ver se os hábitos estão firmes.
- **Objetivos:** bolhas em cruz com checklist de ações, pilares como indicador e a constância ao lado.

Também repete tarefas (dias da semana à escolha, dia útil do mês, pular feriados e fins de semana). O guia completo, com todas as telas e limites, está no [LEIA-ME](LEIA-ME.md).

## Seus dados

Ficam no navegador deste computador. Limpar os dados do navegador, trocar de navegador ou de computador faz o caderno sumir. Em **Ajustes**, **Seus dados**, use "Baixar uma cópia" para guardar um arquivo `.json` e "Carregar uma cópia" para trazer tudo de volta.

Se você usa o git, não coloque essa cópia no repositório: ela tem as suas tarefas. Os arquivos `caderno-*.json` já estão no `.gitignore`.

Na primeira abertura, o caderno mostra dados de exemplo, só de ilustração. "Voltar ao exemplo", em Ajustes, restaura.

## Testes

Precisa do Node.js 22 ou mais novo (testado com a versão 24).

```bash
node --test "tests/*.test.js"
```

## Licenças

O código deste repositório é distribuído sob a licença MIT (arquivo [`LICENSE`](LICENSE)). As letras em `fonts/` são distribuídas sob a SIL Open Font License; veja os arquivos `LICENSE-*` na pasta.
