const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;
//teste
app.use(express.json());

// Funções auxiliares
function formatarData(data) {
  if (!data) return null;
  const limpa = data.replace(/\D/g, '');
  if (limpa.length === 8) {
    const dia = limpa.slice(0, 2);
    const mes = limpa.slice(2, 4);
    const ano = limpa.slice(4);
    const anoNum = parseInt(ano, 10);
    const mesNum = parseInt(mes, 10);
    const diaNum = parseInt(dia, 10);
    const anoAtual = new Date().getFullYear();
    if (anoNum >= 1900 && anoNum <= anoAtual && mesNum >= 1 && mesNum <= 12 && diaNum >= 1 && diaNum <= 31) {
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

function validarCPF(cpf) {
  if (!cpf) return false;
  const apenasDigitos = cpf.replace(/\D/g, '');
  return /^\d{11}$/.test(apenasDigitos);
}

function validarEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function buscarEndereco(cep) {
  try {
    const apenasDigitos = cep.replace(/\D/g, '');
    const response = await axios.get(`https://viacep.com.br/ws/${apenasDigitos}/json/`);
    if (response.data.erro) return {};
    return {
      logradouro: response.data.logradouro,
      bairro: response.data.bairro,
      cidade: response.data.localidade,
      uf: response.data.uf
    };
  } catch {
    return {};
  }
}

// Captura dados mesmo que estejam em texto
function extrairNumero(texto) {
  return texto.replace(/\D/g, '');
}

function extrairDatas(texto) {
  const regex = /(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{8})/g;
  const matches = texto.match(regex);
  if (!matches) return null;
  return formatarData(matches[0].replace(/[\/\-]/g, ''));
}

// Endpoint principal
app.post('/validar-dados', async (req, res) => {
  const entrada = req.body.texto || '';

  // Separar por espaços e vírgulas para facilitar parsing
  const partes = entrada.split(/[\s,]+/);

  let cpf = null, email = null, data_nascimento = null;
  let cep = null, numero_residencia = null;

  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];

    if (!cpf && validarCPF(p)) { cpf = p; continue; }
    if (!email && validarEmail(p)) { email = p; continue; }
    if (!data_nascimento) {
      const data = extrairDatas(p);
      if (data) { data_nascimento = data; continue; }
    }
    if (!cep && /^\d{5}-?\d{3}$|^\d{8}$/.test(p)) { cep = p; continue; }
    if (!numero_residencia && /^\d{1,5}$/.test(p)) { numero_residencia = p; continue; }
  }

  // Buscar endereço se houver CEP
  const endereco = cep ? await buscarEndereco(cep) : {};

  const dados = { cpf, email, data_nascimento, cep, numero_residencia, ...endereco };
  const nomesCampos = { cpf: 'CPF', email: 'email', data_nascimento: 'data de nascimento', cep: 'CEP', numero_residencia: 'número da residência' };

  const preenchidos = [];
  const faltantes = [];

  for (const key in nomesCampos) {
    if (dados[key]) preenchidos.push(nomesCampos[key]);
    else faltantes.push(nomesCampos[key]);
  }

  let message = '';
  let status = 'complete';

  if (preenchidos.length === 0) {
    message = '⚠️ Por favor, poderia me informar os seus dados?';
    status = 'incomplete';
  } else if (faltantes.length > 0) {
    message = `Você preencheu os dados ${preenchidos.join(', ')} corretamente, mas faltaram ${faltantes.join(', ')}. Você poderia informar novamente, por favor?`;
    status = 'incomplete';
  } else {
    message = '✅ Todos os dados foram identificados com sucesso.';
  }

  return res.json({
    ...dados,
    status,
    message
  });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
