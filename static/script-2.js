(function () {
  // ============ BASE DE CONHECIMENTO ============
  // Cada intenção tem: palavras-chave (kw), resposta (text), atalhos de
  // continuação (chips) e botões que abrem telas do sistema (actions).
  var LOGGED_OUT_MENU = [
    { label: 'Como fazer login', intent: 'login' },
    { label: 'Criar cadastro', intent: 'register' },
    { label: 'Esqueci minha senha', intent: 'forgot' },
    { label: 'Como funciona o agendamento', intent: 'booking' },
    { label: 'Horários das aulas', intent: 'times' },
    { label: 'Dias sem reserva', intent: 'nonschool' }
  ];
  var TEACHER_MENU = [
    { label: 'Como fazer uma reserva', intent: 'booking' },
    { label: 'Como usar o calendário', intent: 'calendar' },
    { label: 'Horários das aulas', intent: 'times' },
    { label: 'Dias sem reserva', intent: 'nonschool' },
    { label: 'Horário já reservado', intent: 'conflict' },
    { label: 'Configurações e tema', intent: 'settings' }
  ];
  var DIRECTOR_MENU = [
    { label: 'Cadastrar sala', intent: 'director' },
    { label: 'Horário não aparece', intent: 'noRooms' },
    { label: 'Horários das aulas', intent: 'times' },
    { label: 'Perfis de usuário', intent: 'profiles' },
    { label: 'Configurações e tema', intent: 'settings' }
  ];

  var INTENTS = {
    greeting: {
      kw: ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'hello', 'hey', 'eae'],
      text: '' // resposta montada dinamicamente por welcome()
    },

    overview: {
      kw: ['para que serve', 'o que e o yarooms', 'o que e yarooms', 'o que faz', 'sobre o sistema', 'como funciona o sistema',
           'como funciona o yarooms', 'visao geral', 'como usar', 'tutorial', 'comecar', 'primeiros passos', 'o que e isso'],
      weak: ['como funciona', 'funciona', 'yarooms', 'sistema'],
      text: '**YaRooms** é um sistema de agendamento de salas e espaços da escola, feito para evitar conflitos de horário e papelada.\n\n' +
        '• **Professores** consultam o calendário e reservam salas.\n' +
        '• **Diretores** cadastram as salas (nome, capacidade e horários liberados).\n\n' +
        'O caminho é: **criar cadastro → entrar → escolher sala, dia e horários → confirmar reserva**.\nQuer detalhes de alguma etapa?',
      chips: [
        { label: 'Como fazer login', intent: 'login' },
        { label: 'Criar cadastro', intent: 'register' },
        { label: 'Como funciona o agendamento', intent: 'booking' },
        { label: 'Perfis de usuário', intent: 'profiles' }
      ]
    },

    login: {
      kw: ['logar', 'login', 'entrar', 'acessar', 'acesso', 'fazer login', 'como entro', 'autenticar', 'sign in', 'acessar conta'],
      text: 'Para entrar no YaRooms:\n\n' +
        '1. Na tela inicial, clique em **Fazer reserva agora**.\n' +
        '2. Digite o **e-mail** e a **senha** do seu cadastro.\n' +
        '3. Clique em **Entrar**.\n\n' +
        'Professores vão direto para o **calendário de reservas**; diretores vão para o **Painel do diretor**.\n\n' +
        'Ainda não tem conta? Faça o cadastro primeiro. Esqueceu a senha? Use **Esqueci minha senha**.',
      chips: [
        { label: 'Criar cadastro', intent: 'register' },
        { label: 'Esqueci minha senha', intent: 'forgot' },
        { label: 'Não consigo entrar', intent: 'loginErrors' }
      ],
      actions: function () { return loggedOut() ? [{ label: 'Abrir tela de login', run: function () { go('login'); } }] : []; }
    },

    register: {
      kw: ['cadastr', 'criar conta', 'criar cadastro', 'nova conta', 'registrar', 'nao tenho conta', 'primeiro acesso', 'abrir conta', 'sign up'],
      text: 'Para criar sua conta:\n\n' +
        '1. Na tela de login, clique em **Criar cadastro**.\n' +
        '2. Preencha **nome completo**, **e-mail** e **tipo de usuário** (Professor(a) ou Diretor(a)).\n' +
        '3. Crie uma **senha** e repita em **Confirmar senha**.\n' +
        '4. Clique em **Cadastrar**. Você volta para o login com o e-mail já preenchido.\n\n' +
        'Cada e-mail só pode ter um cadastro.',
      chips: [
        { label: 'Regras da senha', intent: 'passwordRules' },
        { label: 'Perfis de usuário', intent: 'profiles' },
        { label: 'Como fazer login', intent: 'login' }
      ],
      actions: function () { return loggedOut() ? [{ label: 'Abrir tela de cadastro', run: function () { go('register'); } }] : []; }
    },

    passwordRules: {
      kw: ['regra senha', 'regras da senha', 'requisitos', 'senha fraca', 'senha forte', 'senha media', 'caractere especial', 'maiuscula',
           'criar senha', 'senha precisa', 'senha invalida', 'nao coincidem', 'como deve ser a senha', 'qual senha'],
      text: 'A senha do cadastro precisa ter:\n\n' +
        '• **mínimo de 6 caracteres**\n' +
        '• **1 letra maiúscula**\n' +
        '• **1 caractere especial** (como ! @ # $ %)\n\n' +
        'Enquanto você digita, o sistema mostra se a senha está **fraca**, **média** ou **forte**. Para ficar forte, use 10 ou mais caracteres, com letras minúsculas e números.\n' +
        'Os campos **Senha** e **Confirmar senha** devem ser iguais.',
      chips: [
        { label: 'Criar cadastro', intent: 'register' },
        { label: 'Esqueci minha senha', intent: 'forgot' }
      ]
    },

    forgot: {
      kw: ['esqueci', 'recuperar', 'recuperacao', 'redefinir', 'resetar', 'trocar senha', 'mudar senha', 'perdi a senha', 'codigo', 'verificacao', 'reenviar', 'nao lembro'],
      text: 'Para recuperar sua senha:\n\n' +
        '1. Na tela de login, clique em **Esqueci minha senha**.\n' +
        '2. Informe o **e-mail cadastrado** e clique em **Enviar código de recuperação**.\n' +
        '3. Digite o **código de 6 dígitos** recebido no e-mail e clique em **Confirmar código**.\n' +
        '4. Não chegou? Clique em **Reenviar código**.\n\n' +
        'Dica: confira a caixa de **spam** e veja se o e-mail é o mesmo usado no cadastro.',
      chips: [
        { label: 'Como fazer login', intent: 'login' },
        { label: 'Regras da senha', intent: 'passwordRules' }
      ],
      actions: function () { return loggedOut() ? [{ label: 'Recuperar senha', run: function () { go('forgot'); } }] : []; }
    },

    loginErrors: {
      kw: ['senha incorreta', 'email nao cadastrado', 'nao consigo entrar', 'nao consigo logar', 'nao consigo acessar', 'erro login', 'nao entra',
           'deu erro', 'ja cadastrado', 'nao funciona', 'problema para entrar', 'nao loga', 'erro ao entrar'],
      text: 'Veja o que cada aviso significa:\n\n' +
        '• **E-mail não cadastrado** → crie sua conta em **Criar cadastro** ou confira se digitou o e-mail certo.\n' +
        '• **Senha incorreta** → tente de novo; se não lembra, use **Esqueci minha senha**.\n' +
        '• **Este e-mail já está cadastrado** (no cadastro) → vá direto para o login.\n' +
        '• **As senhas não coincidem** → digite a mesma senha nos dois campos.\n' +
        '• **A senha precisa ter...** → veja as regras de senha.',
      chips: [
        { label: 'Esqueci minha senha', intent: 'forgot' },
        { label: 'Criar cadastro', intent: 'register' },
        { label: 'Regras da senha', intent: 'passwordRules' }
      ]
    },

    profiles: {
      kw: ['professor', 'tipo de usuario', 'perfil', 'perfis', 'permissao', 'quem pode', 'diretor ou professor', 'qual tipo'],
      text: 'Existem dois tipos de usuário, escolhidos no cadastro:\n\n' +
        '• **Professor(a)** → vê o calendário e faz **reservas** de salas.\n' +
        '• **Diretor(a)** → acessa o **Painel do diretor** para **cadastrar salas** e definir os horários liberados de cada uma.\n\n' +
        'O sistema direciona você para a tela certa assim que faz login.',
      chips: [
        { label: 'Como funciona o agendamento', intent: 'booking' },
        { label: 'Painel do diretor', intent: 'director' }
      ]
    },

    booking: {
      kw: ['agendamento', 'agendar', 'reservar', 'reserva', 'fazer reserva', 'nova reserva', 'marcar sala', 'como reservo', 'agenda', 'reservar sala'],
      text: '**Como funciona o agendamento:**\n\n' +
        '1. Entre com sua conta de professor(a).\n' +
        '2. No calendário, clique em **Nova reserva**.\n' +
        '3. Escolha a **sala** (aparecem as cadastradas pelo diretor).\n' +
        '4. Escolha o **dia** e marque um ou mais **horários**. Só aparecem os horários liberados para aquela sala.\n' +
        '5. Se quiser, escreva uma **observação** (ex.: "Aula de robótica — turma 9º ano A"). Ela aparece no calendário no lugar do seu nome.\n' +
        '6. Clique em **Confirmar reserva**.\n\n' +
        '**Regras:**\n' +
        '• Não é possível reservar em **fins de semana e feriados**.\n' +
        '• Se algum horário já estiver reservado naquela sala, o sistema avisa e **não confirma**.\n' +
        '• A reserva aparece na grade semanal (Seg a Sex), na semana do dia escolhido.',
      chips: [
        { label: 'Horários das aulas', intent: 'times' },
        { label: 'Dias sem reserva', intent: 'nonschool' },
        { label: 'Horário já reservado', intent: 'conflict' },
        { label: 'Cancelar reserva', intent: 'cancel' }
      ],
      actions: function () {
        return canReserve() ? [{ label: 'Abrir Nova reserva', run: function () { openReserveModal(); } }] : [];
      }
    },

    times: {
      kw: ['horario', 'horarios', 'aulas', 'periodo', 'que horas', 'quais horas', 'intervalo', 'tempo de aula', 'duracao'],
      text: '**Horários das aulas disponíveis para reserva:**\n\n' +
        '**Manhã**\n07:00–07:50 · 07:50–08:40 · 08:40–09:30\n09:50–10:40 · 10:40–11:30 · 11:30–12:20\n\n' +
        '**Tarde**\n13:00–13:50 · 13:50–14:40 · 14:40–15:30\n15:50–16:40 · 16:40–17:30 · 17:30–18:20\n\n' +
        '**Noite**\n19:00–19:45 · 19:45–20:30 · 20:30–21:30\n21:30–22:15 · 22:15–23:00\n\n' +
        'Cada sala pode ter horários diferentes: o diretor define quais ficam liberados.',
      chips: [
        { label: 'Como funciona o agendamento', intent: 'booking' },
        { label: 'Horário não aparece', intent: 'noRooms' }
      ]
    },

    nonschool: {
      kw: ['feriado', 'feriados', 'fim de semana', 'sabado', 'domingo', 'dia nao letivo', 'nao letivo', 'carnaval', 'dias sem reserva', 'dia bloqueado', 'dias bloqueados',
           'reservar sabado', 'reservar no sabado', 'reservar domingo', 'reservar no domingo', 'reservar feriado', 'reservar no feriado', 'reservar em feriado'],
      weak: ['sabado', 'domingo', 'feriado'],
      text: 'Sábado é dia letivo. O sistema **bloqueia reservas em domingos e feriados**. Ao tentar, aparece: "Não é possível reservar em dia não letivo".\n\n' +
        '**Feriados bloqueados:**\n' +
        '• 01/01 Ano Novo · 21/04 Tiradentes · 01/05 Dia do Trabalho\n' +
        '• 07/09 Independência · 12/10 N. Sra. Aparecida · 02/11 Finados\n' +
        '• 15/11 Proclamação da República · 20/11 Consciência Negra · 25/12 Natal\n\n' +
        '**Em 2026 também:** Carnaval (03 a 05/03), Paixão de Cristo (02/04), Páscoa (03/04) e Corpus Christi (21/05).',
      chips: [
        { label: 'Como funciona o agendamento', intent: 'booking' },
        { label: 'Horários das aulas', intent: 'times' }
      ]
    },

    conflict: {
      kw: ['ja reservado', 'ja estao reservados', 'conflito', 'ocupad', 'indisponivel', 'horario ocupado', 'dois professores', 'mesmo horario', 'ja reservaram'],
      text: 'O aviso **"Um ou mais horários já estão reservados para esta sala!"** significa que outra pessoa já reservou aquele horário nessa sala.\n\n' +
        '• Consulte o **calendário** (use as setas de turno e o mini calendário) para achar um horário livre.\n' +
        '• Ou escolha **outra sala** ou **outro horário**.\n' +
        '• Se você marcou vários horários e um deles está ocupado, **nenhum** é reservado: desmarque o ocupado e confirme de novo.',
      chips: [
        { label: 'Como ver o calendário', intent: 'calendar' },
        { label: 'Como funciona o agendamento', intent: 'booking' }
      ]
    },

    noRooms: {
      kw: ['nenhuma sala', 'sem sala', 'nao tem sala', 'nao aparece sala', 'sala nao aparece', 'salas disponiveis', 'quais salas', 'horario nao aparece', 'nao aparece horario', 'falta sala'],
      text: 'Se aparecer **"Nenhuma sala cadastrada ainda"**, o diretor ainda não cadastrou salas. Só **diretores** cadastram salas, então peça à direção da escola.\n\n' +
        'Se a sala existe mas o horário que você quer **não aparece** na reserva, ele foi desabilitado pelo diretor para aquela sala. O diretor pode reabri-lo em **Editar horários**.',
      chips: [
        { label: 'Painel do diretor', intent: 'director' },
        { label: 'Como funciona o agendamento', intent: 'booking' }
      ]
    },

    calendar: {
      kw: ['calendario', 'semana', 'turno', 'manha tarde noite', 'visualizar', 'ver reservas', 'ver disponibilidade', 'disponibilidade', 'cores', 'grade', 'mini calendario'],
      text: '**Como usar o calendário:**\n\n' +
        '• **Mini calendário** (lateral): troque de mês com ‹ e › e clique em um dia para ver a semana dele.\n' +
        '• **Grade semanal**: colunas de segunda a sábado, com uma linha para cada horário de aula.\n' +
        '• **Turno**: as setas ‹ › alternam entre **Manhã**, **Tarde** e **Noite**.\n' +
        '• Cada reserva aparece colorida na célula, com o nome da sala e a observação (ou o primeiro nome de quem reservou).',
      chips: [
        { label: 'Como funciona o agendamento', intent: 'booking' },
        { label: 'Horário já reservado', intent: 'conflict' }
      ]
    },

    cancel: {
      kw: ['cancelar', 'desmarcar', 'excluir reserva', 'apagar reserva', 'editar reserva', 'alterar reserva', 'mudar reserva', 'remover reserva', 'desfazer reserva', 'errei a reserva'],
      text: 'No calendário, clique em **Minhas reservas** e abra a reserva desejada. Altere os campos e clique em **Salvar alterações**, ou use **Excluir reserva** e confirme.',
      chips: [
        { label: 'Como funciona o agendamento', intent: 'booking' }
      ]
    },

    director: {
      kw: ['diretor', 'cadastrar sala', 'cadastro de sala', 'adicionar sala', 'editar horario', 'editar horarios', 'remover sala', 'capacidade', 'painel do diretor', 'criar sala', 'nova sala', 'salas cadastradas', 'horarios da sala'],
      text: '**Painel do diretor:**\n\n' +
        '• **Cadastrar nova sala**: informe o **nome do espaço** (ex.: Laboratório de Informática), a **capacidade** e marque os **horários disponíveis** (pelo menos um).\n' +
        '• **Salas cadastradas**: lista com capacidade e resumo de horários de cada sala.\n' +
        '• **Editar horários**: marque ou desmarque os horários liberados para reserva naquela sala.\n' +
        '• **×**: remove a sala.\n\n' +
        'As salas cadastradas aqui são as que os professores veem ao fazer uma reserva.',
      chips: [
        { label: 'Perfis de usuário', intent: 'profiles' },
        { label: 'Horários das aulas', intent: 'times' }
      ]
    },

    settings: {
      kw: ['configurac', 'tema', 'modo escuro', 'modo claro', 'escuro', 'claro', 'sair', 'logout', 'deslogar', 'sessao', 'tempo de sessao', 'encerrar'],
      text: 'Clique no seu **nome** (canto superior direito) para abrir as **Configurações**:\n\n' +
        '• **Tema**: alterne entre modo claro e escuro.\n' +
        '• **Sessão**: veja o tempo que você está conectado e o horário de início.\n' +
        '• **Sair**: encerra a sua sessão.',
      chips: menuChips
    },

    passwordGeneric: {
      kw: ['senha'],
      text: 'Sobre senha, posso te ajudar com:',
      chips: [
        { label: 'Esqueci minha senha', intent: 'forgot' },
        { label: 'Regras da senha', intent: 'passwordRules' },
        { label: 'Senha incorreta', intent: 'loginErrors' }
      ]
    },

    human: {
      kw: ['atendente', 'humano', 'suporte', 'falar com alguem', 'contato', 'pessoa', 'reclamar', 'sugestao'],
      text: 'Eu só consigo ajudar com dúvidas sobre o uso do YaRooms. Para outros assuntos, ou se o problema continuar, fale com a **direção ou a coordenação da escola**.',
      chips: menuChips
    },

    thanks: {
      kw: ['obrigad', 'valeu', 'vlw', 'thanks', 'agradeco', 'show', 'perfeito', 'ajudou'],
      text: 'Por nada! 😊 Se surgir mais alguma dúvida, é só chamar.',
      chips: menuChips
    },

    bye: {
      kw: ['tchau', 'ate mais', 'ate logo', 'adeus', 'flw'],
      text: 'Até mais! Bom uso do YaRooms. 👋'
    }
  };

  var FALLBACK = {
    text: 'Não entendi muito bem. 🤔 Tente perguntar de outro jeito, ou escolha um dos assuntos abaixo:',
    chips: menuChips
  };

  // ============ UTILITÁRIOS ============
  function normalize(s) {
    return ' ' + String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }
  function hasState() { return typeof state !== 'undefined' && state; }
  function loggedOut() { return !(hasState() && state.user); }
  function firstName() {
    return hasState() && state.user && state.user.name ? state.user.name.split(' ')[0] : '';
  }
  function canReserve() {
    return hasState() && state.user && typeof isDirector === 'function' && !isDirector(state.user.type);
  }
  function resolve(v) { return typeof v === 'function' ? v() : v; }

  function menuChips() {
    if (loggedOut()) return LOGGED_OUT_MENU;
    return canReserve() ? TEACHER_MENU : DIRECTOR_MENU;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Mensagem inicial: muda conforme o usuário esteja deslogado, professor(a) ou diretor(a).
  function welcome() {
    if (loggedOut()) {
      return {
        text: 'Olá! 👋 Eu sou o assistente do **YaRooms**.\n' +
          'Posso te ajudar com **login**, **cadastro**, **recuperação de senha** e **agendamento de salas**. Sobre o que você quer saber?',
        chips: LOGGED_OUT_MENU
      };
    }
    var n = firstName();
    var rooms = hasState() ? state.rooms.length : 0;
    if (canReserve()) {
      var t = 'Olá, ' + n + '! 👋 Você entrou como **professor(a)**. Agora posso te ajudar a **reservar salas** e a usar o calendário.\n\n';
      t += rooms === 0
        ? '⚠️ Ainda **não há salas cadastradas**. A Nova reserva só funciona depois que o diretor cadastrar uma sala.'
        : 'Há **' + plural(rooms, 'sala cadastrada', 'salas cadastradas') + '** para reservar.';
      t += '\n\nPor onde quer começar?';
      return {
        text: t, chips: TEACHER_MENU,
        actions: function () {
          return hasState() && state.rooms.length > 0
            ? [{ label: 'Abrir Nova reserva', run: function () { openReserveModal(); } }] : [];
        }
      };
    }
    var d = 'Olá, ' + n + '! 👋 Você entrou como **diretor(a)**. Aqui posso te ajudar a **cadastrar salas** e definir os horários de cada uma.\n\n';
    d += rooms === 0
      ? 'Você ainda **não cadastrou nenhuma sala**. Os professores só conseguem reservar depois disso.'
      : 'Você tem **' + plural(rooms, 'sala cadastrada', 'salas cadastradas') + '**.';
    d += '\n\nPor onde quer começar?';
    return { text: d, chips: DIRECTOR_MENU };
  }

  // Pontuação: cada palavra-chave encontrada soma o seu tamanho (frases longas pesam mais).
  function matchIntent(input) {
    var text = normalize(input);
    var best = null, bestScore = 0;
    Object.keys(INTENTS).forEach(function (id) {
      var it = INTENTS[id], score = 0;
      (it.kw || []).forEach(function (k) {
        var nk = normalize(k);
        var short = nk.trim().length <= 3;
        // palavras muito curtas (oi, e ai) só valem como palavra inteira
        if (short ? text.indexOf(nk) !== -1 : text.indexOf(nk.trim()) !== -1) score += nk.trim().length;
      });
      (it.weak || []).forEach(function (k) {
        if (text.indexOf(normalize(k).trim()) !== -1) score += 3;
      });
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return best;
  }

  // Formatação simples: **negrito**, linhas em branco e listas (•, 1.)
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function format(t) {
    return t.split('\n').map(function (line) {
      if (!line.trim()) return '<span class="yr-gap"></span>';
      var h = esc(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      var isLi = /^(•|\d+\.)\s/.test(line);
      return '<span class="' + (isLi ? 'yr-li' : 'yr-line') + '">' + h + '</span>';
    }).join('');
  }

  // ============ INTERFACE ============
  var launcher = document.getElementById('yr-bot-launcher');
  var panel = document.getElementById('yr-bot-panel');
  var box = document.getElementById('yr-messages');
  var form = document.getElementById('yr-form');
  var input = document.getElementById('yr-input');
  var started = false;
  var teaser = document.getElementById('yr-bot-teaser');
  var teaserTimer = null;

  function hideTeaser() { teaser.classList.remove('show'); clearTimeout(teaserTimer); }
  function showTeaser(msg) {
    teaser.textContent = msg;
    teaser.classList.add('show');
    clearTimeout(teaserTimer);
    teaserTimer = setTimeout(hideTeaser, 9000);
  }

  function scrollDown() { box.scrollTop = box.scrollHeight; }

  function addMsg(who, html, isHtml) {
    var d = document.createElement('div');
    d.className = 'yr-msg ' + who;
    if (isHtml) d.innerHTML = html; else d.textContent = html;
    box.appendChild(d);
    scrollDown();
  }

  function clearChips() {
    box.querySelectorAll('.yr-chips').forEach(function (c) { c.remove(); });
  }

  function addChips(chips, actions) {
    if ((!chips || !chips.length) && (!actions || !actions.length)) return;
    var wrap = document.createElement('div');
    wrap.className = 'yr-chips';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'yr-action'; b.textContent = a.label;
      b.addEventListener('click', function () { a.run(); if (window.innerWidth < 520) closePanel(); });
      wrap.appendChild(b);
    });
    (chips || []).forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'yr-chip'; b.textContent = c.label;
      b.addEventListener('click', function () { ask(c.label, c.intent); });
      wrap.appendChild(b);
    });
    box.appendChild(wrap);
    scrollDown();
  }

  var pending = [];
  var chatHistory = [], chatEpoch = 0, chatBusy = false;
  function cancelPending() {
    pending.forEach(clearTimeout); pending = [];
    chatEpoch++; chatHistory = []; chatBusy = false;
    box.querySelectorAll('.yr-typing').forEach(function (t) { t.remove(); });
  }

  function botSay(reply) {
    clearChips();
    var typing = document.createElement('div');
    typing.className = 'yr-typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(typing);
    scrollDown();
    pending.push(setTimeout(function () {
      typing.remove();
      addMsg('bot', format(resolve(reply.text)), true);
      addChips(resolve(reply.chips), reply.actions ? reply.actions() : []);
    }, 450));
  }

  // Respostas locais de contingência e atalhos.
  function getBotReply(text, forcedIntent) {
    var id = forcedIntent || matchIntent(text);
    if (id === 'greeting') return welcome();
    if (id === 'forgot') return {text:'A recuperação de senha ainda não está disponível no servidor. Procure a administração.',chips:menuChips()};
    return id ? INTENTS[id] : FALLBACK;
  }

  async function ask(text, forcedIntent) {
    text = (text || '').trim();
    if (!text || chatBusy) return;
    clearChips(); addMsg('user', text, false);
    if (forcedIntent) { botSay(getBotReply(text, forcedIntent)); return; }
    chatBusy = true;
    var epoch = chatEpoch;
    var typing = document.createElement('div');
    typing.className = 'yr-typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(typing); scrollDown();
    try {
      var result = await apiPost('chat', {message: text, history: chatHistory.slice(-6)});
      if (epoch !== chatEpoch) return;
      chatHistory.push({role:'user',content:text},{role:'assistant',content:result.reply});
      chatHistory = chatHistory.slice(-6);
      addMsg('bot', format(result.reply), true); addChips(menuChips(), []);
    } catch (error) {
      if (epoch !== chatEpoch) return;
      addMsg('bot', 'IA indisponível: ' + error.message + ' Usando ajuda local.', false);
      botSay(getBotReply(text));
    } finally { typing.remove(); if (epoch === chatEpoch) chatBusy = false; }
  }

  function openPanel() {
    panel.classList.add('open');
    launcher.classList.add('seen');
    hideTeaser();
    if (!started) { started = true; botSay(welcome()); }
    setTimeout(function () { scrollDown(); input.focus(); }, 50);
  }
  function closePanel() { panel.classList.remove('open'); }

  launcher.addEventListener('click', function () { panel.classList.contains('open') ? closePanel() : openPanel(); });
  document.getElementById('yr-bot-close').addEventListener('click', closePanel);
  teaser.addEventListener('click', openPanel);

  // Tocar no nome "YaRoomy" volta para as opções iniciais.
  document.getElementById('yr-bot-home').addEventListener('click', function () {
    cancelPending();
    box.innerHTML = '';
    started = true;
    botSay(welcome());
    input.focus();
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value; input.value = '';
    ask(v);
  });

  // Esconde o botão durante a animação de abertura (tela de intro).
  function syncLauncher() {
    var intro = document.getElementById('screen-intro');
    var onIntro = intro && intro.classList.contains('active');
    launcher.classList.toggle('show', !onIntro);
    if (onIntro) closePanel();
  }
  // Acompanha o login/logout: o assistente passa a ajudar "lá dentro" conforme o perfil.
  var lastUser = null;
  function syncSession() {
    var key = hasState() && state.user ? state.user.email : null;
    if (key === lastUser) return;
    var hadUser = lastUser;
    lastUser = key;

    if (hadUser || key) {            // saiu da conta (ou trocou de conta): limpa a conversa anterior
      cancelPending(); box.innerHTML = ''; started = false; hideTeaser();
    }
    if (key) {                // entrou: mensagem de boas-vindas do perfil
      if (!panel.classList.contains('open')) { cancelPending(); box.innerHTML = ''; }
      started = true;
      botSay(welcome());
      if (!panel.classList.contains('open')) {
        launcher.classList.remove('seen');
        showTeaser('Olá, ' + firstName() + '! ' + (canReserve() ? 'Posso te ajudar a reservar salas.' : 'Posso te ajudar a cadastrar salas.') + ' 👋');
      }
    } else if (panel.classList.contains('open')) {
      started = true; botSay(welcome());
    }
  }

  function tick() { syncLauncher(); syncSession(); }
  tick();
  setInterval(tick, 400);
})();
