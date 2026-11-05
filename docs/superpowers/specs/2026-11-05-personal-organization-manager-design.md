# Personal Organization Manager: desenho da v1

Data: 2026-11-05
Repo: https://github.com/paulorenato2002/Personal-Organization-Manager

## 1. Objetivo

Um "do-it" leve, salvo na máquina de cada pessoa, que substitui os rabiscos em papel por algo prático e legível. Organiza demandas de trabalho por setor e cliente, demandas pessoais, compromissos e hábitos.

**Sucesso significa:**

- Adicionar uma demanda leva poucos segundos e não exige preencher formulário.
- A tela principal mostra só o necessário; os detalhes ficam escondidos até serem pedidos.
- O visual é atual e personalizável, sem cara de sistema antigo.
- Os dados ficam na máquina do usuário, e não dependem de conta nem de internet.
- Outras pessoas conseguem usar o app com os próprios dados.

## 2. Fora da v1

- Login, nuvem e sincronização entre aparelhos
- Notificações
- Gráficos elaborados
- Mais de um perfil no mesmo navegador (cada pessoa usa a própria cópia)

## 3. Telas

Navegação em um menu flutuante no topo: Quadro, Hoje, Agenda, Checkpoint, seletor de sessão, busca e avatar do perfil (que dá acesso a Perfil e Ajustes).

### 3.1 Quadro (tela inicial)

- Mostra os setores da sessão atual como cards de vidro sobre o papel de parede.
- Cada card tem duas colunas: Rotinas e Pontuais. Compromissos aparecem na coluna Pontuais com data e hora, até o horário passar.
- Cada linha mostra apenas: checkbox, etiqueta do cliente (se houver), título e prazo (se houver).
- Topo da tela: saudação com o nome do perfil e barra de progresso do dia.
- Cada coluna tem um campo de adição rápida (seção 5.4).
- Clicar em uma etiqueta de cliente abre a lista de tudo daquele cliente, em todas as sessões e setores.
- Clicar em uma demanda abre o painel de detalhes (seção 3.6).
- Setores podem ser criados, renomeados, reordenados e excluídos. Excluir um setor com demandas pede confirmação.

### 3.2 Hoje

Tem três abas:

- **Hoje:** checklist único, agrupado por setor, com rotinas que vencem hoje ou estão atrasadas, compromissos de hoje e pontuais com data de hoje.
- **Pendências:** relação das pontuais não cumpridas (seção 5.2). Mostra um contador na aba.
- **Histórico:** por dia, o que foi concluído, adiado e excluído entre as pontuais.

### 3.3 Agenda

- Visões de mês, semana e dia.
- Mostra compromissos e demandas com data. Rotinas aparecem nas datas em que ocorrem.
- Clicar em um dia no mês abre a visão do dia. Clicar em um horário na semana ou no dia cria um compromisso nesse horário.

### 3.4 Checkpoint

Hábitos independentes de sessão, separados em grupos que o usuário cria (ex.: Alimentação, Treino, Saúde).

| Tipo | Exemplo | Como marca |
|---|---|---|
| Sim ou não | Treino | Um clique |
| Contador com meta | Água, 8 copos | Botão `+1` e `-1` |
| Lista do dia | Café, almoço, jantar | Um check por item |

- Cada hábito mostra os últimos 7 dias e a sequência atual de dias cumpridos.
- Um dia conta como cumprido quando: o sim ou não está marcado, o contador atingiu a meta ou todos os itens da lista estão marcados.
- É possível navegar para dias anteriores e corrigir o registro.
- Começa com os exemplos Água, Treino e Refeições, que podem ser editados ou excluídos.

### 3.5 Perfil

Bem básico, aberto pelo avatar:

- Foto
- Nome
- E-mail e telefone
- Até 3 links
- Símbolo pessoal: um emoji escolhido em uma coleção, usado como marca da pessoa no avatar quando não há foto e ao lado da saudação

Todos os campos são opcionais. Os dados ficam só na máquina, junto com o resto.

### 3.6 Painel de detalhes

Painel lateral que abre sobre a tela ao clicar em uma demanda. Fecha com `Esc` ou clicando fora.

- Campos: título, tipo (rotina, pontual, compromisso), setor, cliente, notas e subtarefas.
- Conforme o tipo: frequência (rotina), data (pontual) ou data, hora e duração (compromisso).
- Histórico da demanda: conclusões, adiamentos e mudanças de data.
- Excluir, com opção de desfazer por alguns segundos.

### 3.7 Ajustes

- **Aparência:** tema claro ou escuro, cor de destaque, letra, tamanho da letra, papel de parede.
- **Sessões:** criar, renomear, reordenar, excluir; foto e ícone por sessão.
- **Setores:** foto e ícone por setor.
- **Dados:** pasta do arquivo automático, exportar, importar, limpar histórico.

## 4. Primeira abertura

Tela simples que pede:

1. Nome (opcional).
2. Como começar: "Com setores de exemplo" ou "Vazio".
3. Escolher a pasta do arquivo automático, com opção de pular (Chrome e Edge).

**Setores de exemplo:**

- Trabalho: Financeiro, Comercial, Operações, Vendas, Suporte
- Pessoal: Geral
- Projetos: Geral

Na opção "Vazio", as sessões Trabalho, Pessoal e Projetos são criadas com um setor Geral cada, para quem não usa esses nomes. Nenhum nome de cliente vem no código.

## 5. Regras

### 5.1 Rotinas

Frequências:

- **Diária**
- **Semanal:** um dia da semana (ex.: toda segunda)
- **Mensal:** um dia do mês, de 1 a 31 (ex.: todo dia 5). Se o mês não tiver esse dia, a rotina cai no último dia do mês.

Comportamento:

- A rotina fica sempre visível no Quadro, com o estado do ciclo atual e a próxima data.
- **Diária:** não acumula. Cada dia começa pendente, e um dia perdido não fica devendo.
- **Semanal e mensal:** ao passar da data sem conclusão, fica marcada como atrasada até ser concluída.
- Vários ciclos perdidos aparecem como uma única pendência, com a data mais antiga. Concluí-la acerta todos os ciclos até hoje.
- Depois de concluída, a rotina volta a ficar pendente sozinha na próxima data.
- Desmarcar desfaz a conclusão mais recente.

### 5.2 Pontuais, pendências e histórico

- Uma pontual nova recebe a **data de hoje** por padrão. A data pode ser trocada ou removida no painel.
- Concluída, ela some do Quadro e passa para o Histórico.
- Pontual com data passada e não concluída vai para a aba **Pendências**, agrupada pelo dia em que deveria ter sido feita. Ela continua visível no Quadro, marcada como atrasada.
- Para cada item da relação, o usuário escolhe uma destas ações:
  - **Para hoje**
  - **Outra data** (seletor de data)
  - **Excluir**
  - **Sem data:** continua no Quadro e não aparece mais em Pendências
- Cada grupo de dia tem ação em lote "Mover tudo para hoje" e "Excluir tudo", ambas com desfazer.
- Pontual sem data nunca aparece em Pendências.
- Toda mudança de data, conclusão e exclusão entra no registro da demanda e no Histórico por dia.
- Excluir é reversível pelo desfazer. Depois, o item deixa de aparecer em qualquer lista, exceto no Histórico, até o usuário usar "Limpar histórico" em Ajustes.

### 5.3 Compromissos

- Têm data, hora e duração (padrão de 1 hora).
- Não entram em Pendências. Depois do horário, ficam apenas na Agenda.

### 5.4 Adição rápida

- Digitar e dar Enter cria a demanda na coluna em que o campo está.
- O formato `CLIENTE - título` separa no primeiro ` - ` (hífen com espaços): `ACME - enviar boletos` cria ou reaproveita o cliente `ACME` e a demanda "enviar boletos". Sem o separador, é uma demanda sem cliente.
- A comparação de clientes ignora maiúsculas e minúsculas. O nome aparece em maiúsculas na etiqueta.
- Cada cliente novo recebe uma cor automática, que pode ser trocada.
- Na coluna Rotinas, a rotina nasce diária, e a frequência é ajustada no painel.

### 5.5 Virada do dia

O app verifica a data ao abrir, ao voltar o foco e a cada minuto. Na virada, atualiza as telas sem precisar recarregar. As datas usam o fuso local da máquina.

## 6. Visual

Base: versão B (Noite).

- Cards de vidro translúcido sobre papel de parede, menu flutuante arredondado no topo, cantos de cerca de 20 px, poucas bordas.
- Letra padrão Manrope. Opções de letra incluídas no projeto: Manrope, Instrument Sans, Fraunces e Segoe UI (do sistema).
- Tema escuro padrão; tema claro com cards de vidro claros.
- Sem foto escolhida, o fundo é um gradiente como o do mockup.
- Uma camada de escurecimento ou clareamento entre fundo e cards mantém o texto legível com qualquer foto.
- Listas limpas: nada além do descrito na seção 3.1 aparece na linha de uma demanda.
- Animações curtas, que respeitam `prefers-reduced-motion`.
- Foco de teclado visível, `Esc` fecha painéis e diálogos.
- Pensado para desktop a partir de 1024 px. Em telas menores, as colunas se empilham.

## 7. Dados

### 7.1 Onde ficam

- **IndexedDB:** armazenamento principal, em todos os navegadores.
- **Arquivo automático (Chrome e Edge):** cópia em `organizador-dados.json` na pasta escolhida, gravada até 2 segundos depois de cada mudança. A permissão da pasta pode pedir um clique ao reabrir o app; enquanto não for dada, um aviso discreto aparece no menu.
- **Exportar e importar:** botão manual que funciona em qualquer navegador. Importar substitui os dados atuais, depois de confirmação e de um backup automático baixado na hora.

O indicador no menu mostra o estado: salvo, salvando ou erro. Se a gravação do arquivo falhar, o app continua funcionando com o IndexedDB e mostra o erro.

### 7.2 Modelo

```
state {
  version, savedAt
  profile   { name, photo, email, phone, links[0..3], symbol }
  settings  { theme, accent, font, fontSize, wallpaper }
  sessions  [{ id, name, icon, cover, order }]
  sectors   [{ id, sessionId, name, icon, cover, order }]
  clients   [{ id, name, color }]
  items     [{ id, kind, sectorId, clientId?, title, notes, subtasks[], createdAt, log[], ...tipo }]
    rotina:      freq { type: daily|weekly|monthly, weekday?, day? }, startDate, doneThrough, completions[]
    pontual:     dueDate?, doneAt?, deletedAt?
    compromisso: start, durationMin, deletedAt?
  habitGroups [{ id, name, order }]
  habits      [{ id, groupId, name, type: check|counter|list, goal?, listItems[]?, order }]
  habitLog    { "AAAA-MM-DD": { habitId: valor } }
}
```

Regras do modelo:

- `doneThrough` é a data do último ciclo acertado da rotina. `completions` guarda as conclusões para o histórico.
- Fotos são reduzidas antes de salvar: papel de parede até 1920 px, capas até 600 px, avatar até 256 px. Ficam embutidas no estado, para que o JSON seja um backup completo.
- `version` permite migrar o formato em versões futuras.
- JSON inválido na importação é recusado com mensagem, sem alterar os dados atuais.

### 7.3 Privacidade e repositório

- O `.gitignore` exclui `organizador-dados*.json` e `.superpowers/`.
- O código não contém nomes de clientes nem dados pessoais. Os setores de exemplo da seção 4 são os únicos nomes de empresas no repositório.

## 8. Arquitetura

HTML, CSS e JavaScript puros, sem build e sem dependências em produção, abertos direto do disco (`file://`). Como o Chrome bloqueia módulos ES em `file://`, são usados scripts clássicos sob um único objeto global `App`.

```
index.html
css/      tokens.css (temas e variáveis), app.css
fonts/    letras incluídas no projeto
js/
  logic/    recurrence.js, pending.js, quickadd.js, habits.js  (regras puras, sem acesso a DOM)
  data/     store.js (estado e mudanças), persist.js (IndexedDB, arquivo, importar e exportar), images.js (redução de fotos)
  ui/       shell.js, board.js, today.js, agenda.js, checkpoint.js, panel.js, profile.js, settings.js, onboarding.js
  main.js
tests/      testes das regras puras, com node --test
```

- **Fluxo:** a interface chama ações de `store`; `store` altera o estado, avisa as telas para redesenhar e aciona `persist`.
- **Regras puras** recebem o estado e a data "de hoje" como parâmetros, para serem testadas sem navegador.

## 8.1 Ajustes depois da v1

Estas decisões substituem o que estiver diferente nas outras seções:

- **Metas no lugar de Checkpoint:** aba com as metas do dia em cima e a grade dos últimos 30 dias embaixo.
- **Quantidade:** meta com objetivo, passo e unidade (ex.: 3000 ml, somando 500 ml).
- **Grade:** verde é 100%, amarelo é parcial, vermelho é nada feito. Hoje fica neutro até haver registro, e os dias antes da meta existir ficam em branco. Clicar em um quadradinho abre o dia.
- **Quadro:** card Hoje com rosca de progresso, métricas, checklist e adição rápida com escolha de setor.
- **Ajustes:** adicionar e excluir clientes, log de atividade e "Pasta dos seus dados" no lugar de "arquivo automático".
- **Pasta com dados:** ao escolher uma pasta que já tem o arquivo, o app pergunta se usa os dados dela ou substitui. Arquivo ilegível nunca é sobrescrito.
- **Perfil:** o símbolo pessoal vira um selo no canto da foto.
- **Modelo padrão:** o repositório leva só um modelo fictício. Dados pessoais ficam em `organizador-dados*.json`, fora do Git, e entram por Importar.

## 8.2 Clientes e data de entrega

- **Aba Clientes:** lista os clientes com contagens. Cada cliente tem uma página com colunas Rotinas e Demandas, campos para adicionar e escolha do setor. Etiqueta e Ajustes abrem essa página.
- **Data de entrega:** é a data da pontual (`dueDate`), não um campo separado. A adição rápida de demandas mostra a data ao focar, começando em hoje. A entrega define quando a tarefa entra em Hoje e quando vence.

## 9. Testes

- **Automáticos (`node --test`):** recorrência (diária, semanal, mensal, dia 31 em meses curtos, fevereiro bissexto, ciclos atrasados), pendências, adição rápida e cumprimento de hábitos.
- **No Chrome, aberto de `file://`:** fluxo completo de cada tela, gravação real do `.json` na pasta, reabertura com os dados preservados, IndexedDB, exportar e importar, troca de tema e papel de parede.

**Riscos ainda não confirmados:** o Chrome expõe a função de escolher pasta em `file://`, mas a gravação real do arquivo e o IndexedDB nessa origem ainda precisam ser testados. Essa verificação é a primeira tarefa da implementação. Se a gravação falhar, o exportar e importar manual continua sendo a garantia, e o usuário é avisado.
