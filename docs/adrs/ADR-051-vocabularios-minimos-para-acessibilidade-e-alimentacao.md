# ADR-051: Restringir acessibilidade e alimentação a vocabulários mínimos com texto complementar controlado

- **Status:** proposed
- **Data:** 2026-10-08
- **Decisores:** produto, privacidade, jurídico, confiança e segurança, backend e frontend
- **Relacionado:** Task 19; ADR-050; RF081; RN014, RN112; RNF001–RNF002
- **Substitui/Substituído por:** N/A

## Contexto

A Task 19 pede vocabulários controlados e uma opção textual mínima, mas não define códigos, combinações, descrição, idiomas, tamanho, proibições ou se alergias devem ser informadas. Texto amplo pode converter o perfil em prontuário, expor condição de saúde/religião, incluir contato ou gerar expectativa de acomodação/segurança que o EventMatch não pode garantir.

## Opções consideradas

1. **Vocabulários estáveis por domínio e texto complementar estritamente limitado a instruções práticas aprovadas.** Proposta: os códigos são a fonte de verdade; texto é opcional, minimizado, normalizado e nunca diagnóstico.
2. Campo livre amplo. Rejeitado: não atende minimização, amplia risco de conteúdo sensível e dificulta projeção segura.
3. Somente booleanos genéricos. Rejeitado: não é suficiente para comunicar necessidade prática nem permite transparência adequada.
4. Nenhum texto complementar. Mantida como alternativa caso jurídico/produto não aprove regra segura para texto.

## Decisão proposta

Definir dois catálogos versionados, um para acessibilidade e outro para alimentação, com códigos estáveis, rótulos localizados, estado ativo e semântica documentada. Cada domínio aceita zero ou mais códigos sem duplicatas, respeitando as combinações que produto aprovar. A necessidade privada não contém diagnóstico, laudo, documento, imagem, URL, contato ou afirmação clínica.

O texto complementar só existirá se produto e jurídico fixarem finalidade, tamanho máximo, categorias de conteúdo permitido, idioma, normalização e política de moderação/recusa. Ele será opcional, tratado como conteúdo sensível, bloqueado de logs/telemetria e omitido de qualquer projeção que não o necessite expressamente. Até esse aceite, nenhum texto nem código é implementado.

## Consequências

- Catálogo permite validação de domínio, compatibilidade histórica e projeção mínima.
- Alterar códigos, rótulos ou combinações exige migration/seed e revisão de contrato/documentação.
- A opção textual, se aceita, exige testes de privacidade, limites e UX que explique que não substitui avaliação médica nem garante acomodação.
- O plano permanece bloqueado pela definição de conteúdo e parecer jurídico.

## Adoção e rollback

Catálogos e schema serão aditivos; itens desativados já selecionados precisam permanecer legíveis e removíveis, sem voltar a ser sugeridos. Rollback desabilita a UI e futuras projeções, preservando dados conforme política jurídica; nenhuma exclusão automática é autorizada por esta ADR.

## Evidências

- `docs/DER-EventMatch-MVP.md` RF081; RN014, RN112; RNF001–RNF002, RNF023, RNF025
- `docs/legal/pt-BR/politica-de-privacidade-v1.0.0.md` §§2–4 e §7
- `docs/03-modelos-de-dominio.md` §§2.2 e 6
