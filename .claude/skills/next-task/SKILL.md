---
name: next-task
description: Prende la prossima issue dalla colonna Ready della board GitHub, la implementa su un branch e apre una PR. Usare quando l'utente chiede di prendere/fare il prossimo task, o passa un numero di issue.
---

# next-task

Argomento opzionale: numero di issue. Senza argomento, prendi la prima card (dall'alto) della colonna **Ready** della board: le card in Backlog non sono ancora pronte.

1. Scegli la issue: `.claude/skills/next-task/ready.sh` stampa le issue in Ready (numero e titolo, in ordine di colonna). Leggila con `gh issue view <N> --json number,title,body,comments`. Scarica e guarda le immagini allegate (`curl -sL -H "Authorization: token $(gh auth token)" -o <scratchpad>/x.png <url>`). Se Ready è vuota, dillo e fermati.
2. Se la descrizione è ambigua in modo sostanziale, commenta sulla issue con la domanda (`gh issue comment`) e fermati; non indovinare.
3. Segna come in corso: `gh issue edit <N> --add-label doing --remove-label todo` e sposta la card: `.claude/skills/next-task/move-card.sh <N> "In progress"`.
4. Parti da main aggiornato: `git switch main && git pull --ff-only && git switch -c task/<N>-<slug-breve>`.
5. Implementa. Rispetta lo stile del codice esistente (Astro, variabili fluid typography/spacing già presenti). Non toccare `assets/` e `source-photos/`.
6. Verifica: `npm run check` e `npm run build` devono passare. Per modifiche visive, avvia `npm run dev` e controlla.
7. Commit con messaggio chiaro, poi `git push -u origin HEAD`.
8. Apri la PR: `gh pr create --title "<titolo>" --body "Closes #<N>\n\n<riassunto e come verificare>"`. Non fare merge: lo fa l'utente.
9. Sposta la issue in review: `gh issue edit <N> --add-label review --remove-label doing` e `.claude/skills/next-task/move-card.sh <N> "In review"`. La colonna Done si sposta da sola alla chiusura della issue (merge della PR).
10. Riporta all'utente il link della PR e cosa hai verificato (o non potuto verificare).

Se qualcosa fallisce, rimetti la label `todo` (e la card in `Ready`), commenta il motivo sulla issue e riferisci l'errore.
