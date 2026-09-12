#!/usr/bin/env python3
"""Build a deterministic curriculum DESIGN, not a runtime-ready IELTS content bank.
Python 3.10+, standard library only. Sources and authored materials are bundled.
Every generated plan declares its production blockers; counts never imply validity.
"""
from __future__ import annotations
import collections
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
SHA = '03e581fb95aefa27268baff5a324948576728b66'
TYPES = {'teaching-card','choice','truth','matching','classification','ordering','cloze','structured-completion','short-answer','word-formation','error-correction','rewrite','pronunciation','dictation','speaking-response','writing-response'}

RESEARCH = {
 'retrieval_practice':'R01', 'distributed_practice':'R02',
 'multidimensional_vocabulary':'R03','collocation_learning':'R04',
 'balanced_language_opportunities':'R05','oral_corrective_feedback':'R06',
 'written_corrective_feedback':'R07','explicit_form_instruction':'R11',
 'extensive_reading':'R12','fluency_task_repetition':'R13',
 'listening_process_instruction':'R14'
}
ROLES = [
 ('Form and meaning','Establish a usable lexical representation and use it in a simple communicative exchange.'),
 ('Sentence architecture','Explain and repair the grammatical relationships needed for the unit topic.'),
 ('Chunks and spoken recognition','Retrieve natural word partners and recognise their boundaries in connected speech.'),
 ('Reading with evidence','Build the meaning of a coherent text and justify answers from its actual wording.'),
 ('Listening with evidence','Track speakers, corrections and discourse while understanding an intact recording.'),
 ('Speaking for a listener','Plan briefly, speak independently, notice a problem and communicate again on a fresh prompt.'),
 ('Writing for a reader','Select content, organise a response, draft independently, revise and transfer.'),
 ('Integration and transfer','Retrieve the unit language and use all four skills without familiar answer-bearing contexts.')
]
# Task-family coverage is deliberately explicit and spiralled, not a prediction of a band.
R_TASKS = ['short-answer','sentence-completion','true-false-not-given','matching-headings','matching-information','multiple-choice','matching-features','summary-completion','yes-no-not-given','matching-sentence-endings']
L_TASKS = ['form-completion','note-completion','table-completion','multiple-choice-single','matching-speakers','plan-labelling','sentence-completion','short-answer','multiple-choice-multiple','flow-chart-completion']
W_TASKS = ['line-graph','bar-chart','table','pie-chart','map-comparison','process-diagram','mixed-visuals','comparison-without-time','multiple-series','process-and-data']
E_TASKS = ['opinion','discuss-both-and-position','advantages-disadvantages','outweigh','causes-solutions','problems-solutions','two-direct-questions','positive-negative-development','evaluate-a-policy','qualified-position']


def dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def source_rows(name):
    return [line.split('|') for line in (DATA/name).read_text(encoding='utf-8').splitlines() if line.strip() and not line.startswith('#')]


def build_modules():
    grammar = {(int(r[0]),int(r[1])):r for r in source_rows('grammar.txt')}
    packs = {e['stage']:e for e in json.loads((ROOT/'examples/reference_materials.json').read_text())}
    substitutions = {(4,9):'navigation',(6,1):'germination',(7,4):'moderation',(7,8):'decarbonisation',(8,4):'attrition',(8,9):'redress',(9,1):'interruption',(9,6):'irreversibility',(10,6):'induced demand',(10,8):'displacement',(11,6):'stewardship',(11,8):'burden sharing'}
    result=[]
    for r in source_rows('modules.txt'):
        st, un = int(r[0]),int(r[1]); g=grammar[(st,un)]
        words=[v.strip() for v in r[3].split(',')]
        seen=set()
        for i,w in enumerate(words):
            if w in seen:
                words[i]=substitutions[(st,un)]
            seen.add(words[i])
        if un==1:
            front=[v[0] for v in packs[st]['lexicon']]
            words=front+[w for w in words if w not in front]
        chunks=[c.strip() for c in r[4].split(';')]
        assert len(words)==24 and len(set(words))==24,(st,un,words)
        assert len(chunks)==6
        result.append({'id':f'S{st:02d}-U{un:02d}','stage':st,'unit':un,'topic':r[2],
          'lexical_targets':words,'collocations':chunks,
          'grammar':{'primary':g[2],'secondary':g[3],'model':g[4],'diagnostic_error':g[5],'explanation':g[6]},
          'provenance':'Original Vocora curriculum selection; not a verified word-frequency or CEFR list. The grammar example is an authored diagnostic, not a copyrighted book exercise.',
          'dictionary_and_corpus_review':'pending',
          'reading_task_family':R_TASKS[(un-1+(st-1)//3)%10],
          'listening_task_family':L_TASKS[(un-1+(st-1)//3)%10],
          'task1_family':W_TASKS[un-1], 'task2_family':E_TASKS[un-1],
          'source_refs':['I02','I03','I04','I05','R03','R04','R11']})
    assert len(result)==120
    dump(DATA/'modules.normalized.json', result)
    return result


def evidence_catalog(sources):
    out=[]
    for pid,sid in RESEARCH.items():
        s=sources[sid]
        out.append({'id':pid,'kind':'research','citation':f"[{sid}] {s['author']} ({s['year']}). {s['title']}. {s['url']}", 'claim':s['supports']})
    out.append({'id':'vocora_prerequisite_synthesis','kind':'design_synthesis','citation':'Original Vocora IELTS curriculum design, 2026-09-09; repository snapshot '+SHA,'claim':'The exact sequence, target counts, stage labels, repair choices and thresholds are design decisions. No cited study validates this whole course or guarantees an IELTS score.'})
    return out


def make_lesson(m, stage, role_index, catalog, pack):
    st,un=m['stage'],m['unit']; role=role_index+1
    number=(st-1)*80+(un-1)*8+role; lid=f'L{number:04d}'
    if role<=4: words=m['lexical_targets'][(role-1)*6:role*6]
    elif role==5: words=m['lexical_targets'][0:6]+m['lexical_targets'][12:18]
    elif role==6: words=m['lexical_targets'][6:12]+m['lexical_targets'][18:24]
    elif role==7: words=m['lexical_targets'][12:24]
    else: words=m['lexical_targets'][:]
    chunks=m['collocations'][((role-1)%3)*2:((role-1)%3)*2+2] if role<=4 else m['collocations'][:]
    vocab_ids=[f'{lid}-V{i+1:02d}' for i in range(len(words))]
    chunk_ids=[f'{lid}-C{i+1:02d}' for i in range(len(chunks))]
    eligible=vocab_ids+chunk_ids
    labels=dict(zip(vocab_ids,words)); labels.update(dict(zip(chunk_ids,chunks)))
    target_specs=[('G1','usage_frame',m['grammar']['primary']),('G2','grammar_warning',m['grammar']['secondary']),('R','reading_comprehension',stage['reading']),('L','listening_comprehension',stage['listening']),('S','speaking_function',stage['speaking']),('W','writing_function',stage['writing']),('P','aural_recognition',stage['phonology']),('Q','exam_mechanic',stage['exam_focus']),('M','transfer_task','Identify a mismatch, correct it and retrieve the capability in a fresh context without overwriting the first attempt.')]
    target_ids={short:f'{lid}-{short}' for short,_,_ in target_specs}
    targets=[{'id':tid,'kind':'vocabulary' if tid in vocab_ids else 'multiword_expression','label':labels[tid],'source_ref':f"data/modules.normalized.json#{m['id']}; original curriculum target selection",'leitner_eligible':True} for tid in eligible]
    targets += [{'id':target_ids[short],'kind':kind,'label':label,'source_ref':f"data/grammar.txt#{m['id']}" if short.startswith('G') else f"data/stages.json#stage-{st}; course specification §§ 5–12",'leitner_eligible':False} for short,kind,label in target_specs]
    all_ids=[t['id'] for t in targets]
    ex=[]; landmarks={}
    is_reference=(un==1 and role==1)
    context=f"{m['topic']}; lesson role: {ROLES[role_index][0]}; stage {st}."
    source_refs=[f"data/modules.normalized.json#{m['id']}",f"data/grammar.txt#{m['id']}",f"data/stages.json#stage-{st}"]
    if is_reference: source_refs.append(f"examples/{pack['id']}.md")

    def s(typ,scope,instruction,prompt,expected,feedback):
        return {'type':typ,'purpose':instruction,'target_ids':list(dict.fromkeys(scope)), 'contract_status':'placeholder',
                'data':{'_placeholder':True,'instruction_intent':instruction,'prompt_or_stimulus':prompt,'expected_response':expected,'feedback_intent':feedback}}

    def add(key,title,scope,slides,research,depends=(),required=True,objective=None,gate=None,reason=None):
        eid=f'{lid}-E{len(ex)+1:02d}'
        scope=list(dict.fromkeys(scope))
        # A specification slide may cover a group of targets; the union is still exact.
        assert set(scope)=={t for sl in slides for t in sl['target_ids']},(lid,key,'scope mismatch')
        for i,sl in enumerate(slides): sl['id']=f'{eid}-S{i+1:02d}'
        prerequisites=[{'exercise_id':landmarks[d], 'reason':r} for d,r in depends]
        ev=reason or f"Within {context} this objective uses the prepared targets rather than adding a new lexical burden; {title.lower()} supplies evidence needed by later independent transfer. This order is a design synthesis, not a tested universal sequence."
        ex.append({'id':eid,'position':len(ex)*10+10,'exercise_type':key,'title':title,'objective':objective or title+'. '+context,
          'required':required,'prerequisites':prerequisites,'source_target_ids':scope,'extension_ids':[],
          'evidence':{'source_refs':source_refs,'research_principle_ids':research,'sequence_reason':ev},
          'completion':{'evidence':('Activate unseen vocabulary in Leitner House 1 once; preserve existing shared vocabulary progress. Record intake exposure, not mastery.' if key=='vocabulary_intake' else 'Persist the original response and assistance state; keep repaired success separate. Production needs a validated artifact; no inferred IELTS score from completion.'),'mastery_gate':gate},'slides':slides})
        landmarks[key]=eid
        return eid

    reveal='After submission, explain the meaning or form contrast; preserve the original answer. This is learning feedback, not examination grading.'
    intake=[]
    reflex={x[0]:x for x in pack['lexicon']} if is_reference else {}
    for tid in eligible:
        w=labels[tid]
        if w in reflex:
            x=reflex[w]; prompt=f"{w} — {x[1]}. Meaning: {x[2]}. Example: {x[3]}"; key=f"Intended sense: {x[2]}"
        else:
            prompt=f"AUTHORING BRIEF, not a finished card: introduce the intended sense of '{w}' in {m['topic']}. Supply a verified plain-English definition, part of speech, pronunciation, one natural example and an optional L1 gloss. Resolve homographs and countability before publication."
            key=f"A verified sense-specific representation of '{w}'; dictionary/corpus review pending, so do not auto-publish."
        intake.append(s('teaching-card',[tid],f"Meet '{w}' before retrieval.",prompt,key,'Do not score exposure as retrieval.'))
        intake.append(s('choice',[tid],f"Recognise the intended meaning of '{w}'.",f"AUTHORING BRIEF: choose the meaning of '{w}' in a new {m['topic']} sentence. Provide one correct sense and two plausible, mutually exclusive alternatives; shuffle without positional cues.",key,reveal))
    add('vocabulary_intake','Vocabulary intake',eligible,intake,['multidimensional_vocabulary'],objective='Introduce the exact eligible lexical scope and activate unseen vocabulary in Leitner House 1; preserve known items.',reason='The lexical representation is needed before a sound-to-form request. This fixed opening is Vocora policy [V01–V03], not a research-proven band gain.')
    add('spelling_dictation','Spelling and dictation',eligible,[s('dictation',[tid],f"Listen and type '{labels[tid]}' without seeing it.",f"AUDIO REQUIRED: sense-disambiguated recording of '{labels[tid]}'; never render this author-side transcript in the learner cue.",labels[tid],'Compare with approved spelling variants; identify grapheme or boundary error. Use the existing practice-only repair policy, never rescore the first attempt.') for tid in eligible],['retrieval_practice','multidimensional_vocabulary'],[('vocabulary_intake','An initial meaning/form representation must exist before exact written-form retrieval.')])
    # Context and form are essential here because every authored unit explicitly supplies these targets.
    add('meaning_in_context','Sense, context and word relationships',vocab_ids,[s('classification',vocab_ids,'Place the target forms in their contextual grammatical and semantic roles.',f"AUTHORING BRIEF: use {', '.join(words)} in separate, natural sentences about {m['topic']}. Identify each word's role in that sentence, not an immutable class for every possible use.",'A sentence-specific classification and a justified meaning contrast. Part-of-speech keys must be verified before release.',reveal),s('short-answer',vocab_ids,'Retrieve a word from a meaning or situation cue without a word bank.',f"AUTHORING BRIEF: one fresh sense-specific cue per target: {', '.join(words)}. Do not require untaught specialist knowledge.",'Each target or an explicitly accepted equivalent; author and validate the cue/answer pairs.',reveal)],['multidimensional_vocabulary','retrieval_practice'],[('spelling_dictation','Exact forms are available for contextual retrieval, without assuming that spelling proves meaning knowledge.')])
    grammar_scope=[target_ids['G1'],target_ids['G2']]
    add('grammar_notice','Notice the sentence relationship',grammar_scope,[s('teaching-card',grammar_scope,'Explain the unit grammar through a worked contrast.',f"MODEL: {m['grammar']['model']}\nCONTRAST: {m['grammar']['diagnostic_error']}\nTARGET: {m['grammar']['primary']}\nRELATED: {m['grammar']['secondary']}",m['grammar']['explanation'],'Explain form, meaning and use. An upper-stage logic/stance contrast is not necessarily an ungrammatical string.'),s('error-correction',grammar_scope,'Repair the diagnosed sentence or overclaim.',m['grammar']['diagnostic_error'],m['grammar']['model']+' Rationale: '+m['grammar']['explanation'],reveal)],['explicit_form_instruction','retrieval_practice'],[('meaning_in_context','Learners must understand the message before analysing the form that conveys it.')])
    add('grammar_transfer','Use the relationship in a different message',grammar_scope+vocab_ids,[s('rewrite',grammar_scope+vocab_ids,'Produce a fresh sentence retaining the intended meaning.',f"AUTHORING BRIEF: create a new {m['topic']} context requiring {m['grammar']['primary']} and selected targets {', '.join(words)}. It must not be a copy of the worked diagnostic.",'A semantically appropriate sentence using the target relationship; accept alternative natural wording and do not demand every listed word in one sentence.',reveal)],['explicit_form_instruction','written_corrective_feedback'],[('grammar_notice','Transfer is meaningful only after the learner has noticed what is wrong and why.')])
    add('collocation_retrieval','Retrieve natural word partners',chunk_ids,[s('matching',chunk_ids,'Connect the partners, then explain their combined meaning.',f"AUTHORING BRIEF: split only at a meaningful boundary: {'; '.join(chunks)}. Include an incompatible distractor whose wrongness can be explained without arbitrary preference.",'; '.join(chunks),reveal),s('cloze',chunk_ids,'Recall the missing partner without an answer bank.',f"AUTHORING BRIEF: one different contextual cue for each chunk: {'; '.join(chunks)}. Check that acceptable synonyms are not marked wrong.",'; '.join(chunks),reveal)],['collocation_learning','retrieval_practice'],[('meaning_in_context','Known meanings are combined into conventional partners rather than memorised as isolated translations.')])
    bridge_scope=chunk_ids+[target_ids['P']]
    add('aural_bridge','Recognise the prepared language in speech',bridge_scope,[s('pronunciation',bridge_scope,'Notice boundaries, prominence and the prepared chunk in connected speech.',f"AUDIO BRIEF: two short contextual versions of {'; '.join(chunks)}. Phonological target: {stage['phonology']}. This is formative pronunciation practice, not a natural IELTS recording.",'Identify the words and the meaningful stress or boundary; accent imitation is not the criterion.','Replay and compare only in learning mode. Repeated clips are not unseen listening evidence.'),s('dictation',bridge_scope,'Retrieve a short phrase heard in connected speech.',f"AUDIO BRIEF: naturally voiced phrase containing {' or '.join(chunks)}; add a short disambiguating context but no later test answers.",'The approved phrase transcription; naturally variable contractions must be specified in the key.',reveal)],['multidimensional_vocabulary','listening_process_instruction'],[('collocation_retrieval','Written chunk knowledge must be connected to its aural form before dependent integrated listening.')])

    rbrief=f"AUTHORING BRIEF {lid}-R: one coherent original text about {m['topic']}, target {stage['read_words'][0]}–{stage['read_words'][1]} words for a full integrated task. Primary operation: {stage['reading']} Use {m['reading_task_family']} as the scheduled family, simplified where needed; lexical scope {', '.join(words)}. Teach language, never the later answer-bearing facts. Supply the full text, all prompts, unambiguous keys, evidence spans and distractor rationales."
    lbrief=f"AUTHORING BRIEF {lid}-L: an original natural recording about {m['topic']}, {stage['listen_seconds'][0]}–{stage['listen_seconds'][1]} seconds for a full integrated task. Primary operation: {stage['listening']} Scheduled family: {m['listening_task_family']}. Supply the complete script, speaker metadata, licensed/commissioned human audio, timestamps, item keys and explanations; do not substitute isolated TTS."
    if is_reference:
        rbrief=f"AUTHORED REFERENCE {pack['id']}-R, a focused extract rather than a full-length stage assessment:\n"+pack['reading']['text']
        lbrief=f"AUTHORED SCRIPT {pack['id']}-L; recording not supplied:\n"+pack['listening']['script']
    read_scope=[target_ids['R'],target_ids['Q']]
    read_slides=[s('teaching-card',read_scope,'Read for the main message before selecting details.',rbrief,'State a defensible gist; keep the coherent text accessible during practice.','The first skim precedes questions; do not display an answer summary in a scored task.')]
    if is_reference:
        for q in pack['reading_questions']:
            read_slides.append(s(q['type'],read_scope,q['prompt'],f"Refer to {pack['id']}-R. {q['prompt']}",q['answer'],q['rationale']))
    else:
        read_slides += [s('choice',read_scope,'Select the best supported overall interpretation.',rbrief+'\nAUTHOR one gist prompt and plausible alternatives.','One evidence-supported answer; final wording and key are not yet authored.',reveal),s('short-answer',read_scope,'Locate the words that support the answer and state the answer separately.',rbrief+'\nAUTHOR two detail or inference items at the stage demand.','Answer plus an exact evidence span; interpretation must not add unsupported facts.',reveal)]
    add('reading_integration','Read an intact text and justify meaning',read_scope,read_slides,['balanced_language_opportunities','explicit_form_instruction'],[('grammar_transfer','The grammar required to parse the passage has been practised.'),('collocation_retrieval','The text can now integrate prepared chunks without becoming an answer-preteaching exercise.')])
    listen_scope=[target_ids['L'],target_ids['Q']]
    lslides=[s('teaching-card',listen_scope,'Predict the information category, then monitor the actual message.',lbrief,'Predict a possible answer type, not a guessed factual answer.','Guided replay is allowed here; a later sealed test has one uninterrupted play and no transcript.')]
    if is_reference:
        for q in pack['listening_questions']:
            lslides.append(s(q['type'],listen_scope,q['prompt'],f"Use recording {pack['id']}-L; script remains author-side. {q['prompt']}",q['answer'],q['rationale']))
    else:
        lslides += [s('choice',listen_scope,'Identify the main purpose after listening.',lbrief+'\nAUTHOR one purpose item without keyword-only distractors.','An interpretation supported by the recording; full key and audio still required.',reveal),s('structured-completion',listen_scope,'Complete a coherent detail task and respect its answer limit.',lbrief+'\nAUTHOR a linked 3–6-item completion group; retain the whole form/table when appropriate.','A verified key per field, including word limit, variants and audio evidence timestamps.','After the whole group, explain correction markers or lost place; do not leak answers between linked items.')]
    add('listening_integration','Listen to a coherent message',listen_scope,lslides,['listening_process_instruction','balanced_language_opportunities'],[('aural_bridge','Spoken forms have been prepared before the learner must track the integrated message.')])

    # Primary lesson purpose determines the additional depth, not a universal post-opening list.
    depth={1:[('context_contrast','Contrast two plausible senses','short-answer'),('independent_lexical_recall','Retrieve without recognition options','cloze')],
      2:[('head_and_dependents','Find the head and its dependents','classification'),('form_meaning_contrast','Compare form with changed meaning','choice'),('sentence_reconstruction','Reconstruct the intended relationship','ordering'),('sentence_error_transfer','Repair a different sentence','error-correction')],
      3:[('collocation_contrast','Distinguish a natural partner from a misleading near-synonym','choice'),('chunk_free_recall','Retrieve chunks from a communicative intention','short-answer'),('connected_chunk_dictation','Recover word boundaries from a phrase','dictation')],
      4:[('reading_task_mechanics','Apply this reading question family','structured-completion'),('evidence_vs_assumption','Separate text evidence from outside assumptions','truth'),('reference_chains','Track who or what a reference denotes','matching'),('paragraph_function','Explain why a sentence or paragraph is present','short-answer')],
      5:[('listening_task_mechanics','Apply this listening question family','structured-completion'),('correction_and_final_choice','Track a correction or changed decision','short-answer'),('speaker_tracking','Attribute the message to the correct speaker','matching'),('listening_reflection','Locate the reason for a comprehension failure','short-answer')],
      6:[('listener_purpose','Answer the actual question rather than recite a script','choice'),('idea_development','Develop an answer with a relevant example','speaking-response'),('intelligibility_focus','Make a targeted word boundary or prominence clearer','pronunciation')],
      7:[('response_requirements','Identify every required part of the writing prompt','classification'),('organisation_plan','Order ideas by communicative function','ordering'),('sentence_paragraph_link','Link ideas without mechanical connectors','rewrite'),('evidence_and_scope','Avoid an unsupported or exaggerated claim','error-correction')],
      8:[('cross_text_transfer','Compare two messages without confusing their sources','short-answer'),('mixed_task_constraints','Keep answer constraints while switching task family','structured-completion'),('unit_retrieval','Retrieve this unit’s targets from changed cues','cloze')]}
    for key,title,typ in depth[role]:
        if role==1: scope=vocab_ids
        elif role==2: scope=grammar_scope
        elif role==3: scope=chunk_ids+[target_ids['P']]
        elif role==4: scope=read_scope
        elif role==5: scope=listen_scope
        elif role==6: scope=[target_ids['S'],target_ids['P']]
        elif role==7: scope=[target_ids['W'],target_ids['G2']]
        else: scope=[target_ids['R'],target_ids['L'],target_ids['Q']]+(eligible if key=='unit_retrieval' else [])
        parent='reading_integration' if role==4 else 'listening_integration' if role==5 else 'grammar_notice' if role==2 else 'collocation_retrieval' if role==3 else 'meaning_in_context'
        principles=['retrieval_practice']
        if role==2: principles.append('explicit_form_instruction')
        if role==3: principles.append('collocation_learning')
        if role==5: principles.append('listening_process_instruction')
        add(key,title,scope,[s('teaching-card',scope,'Study one worked example of this subskill.',f"AUTHORING BRIEF: {title}. {context} Grammar: {m['grammar']['primary']}; chunks: {'; '.join(chunks)}. At stage {st}, use the demand stated in data/stages.json, not an assumed band conversion.",'A worked, source-supported explanation; no answer-bearing facts from the later mastery set.',reveal),s(typ,scope,'Apply the subskill to a parallel case with less help.',f"AUTHORING BRIEF: construct a fresh parallel item for '{title}' in {context} Expected reading family: {m['reading_task_family']}; listening family: {m['listening_task_family']}. Final stimulus and keyed response require authorship and review.",'A justified response to the authored case; do not auto-score this specification string.',reveal)],principles,[(parent,'The integrated or foundational exercise has established the capability this focused operation extends.')])
    if st>=4 and role in (2,4,7,8):
        scope=[target_ids['G2'],target_ids['R'],target_ids['W']]
        add('paraphrase_scope','Paraphrase without changing the claim',scope,[s('choice',scope,'Compare two paraphrases for preserved actor, time, quantity and certainty.',f"AUTHORING BRIEF: use {m['topic']}; create a minimal scope contrast appropriate to {m['grammar']['secondary']}.",'The version preserving the original proposition, not merely sharing synonyms.',reveal),s('rewrite',scope,'Produce your own meaning-preserving paraphrase.',f"AUTHORING BRIEF: a new source claim about {m['topic']} that can be paraphrased with familiar language.",'Natural wording preserving scope and evidence strength; accepted response families must be explicit.',reveal)],['explicit_form_instruction','multidimensional_vocabulary'],[('grammar_transfer','Language transformations need a stable interpretation before paraphrase is judged.')])
    if st>=7 and role in (4,5,6,7,8):
        scope=[target_ids['R'],target_ids['L'],target_ids['G2']]
        add('qualified_inference','Distinguish observation, inference and limitation',scope,[s('classification',scope,'Classify what is reported, inferred or still unknown.',f"AUTHORING BRIEF: a {m['topic']} claim with a stated sample or boundary. Do not require external policy expertise.",'A defensible classification based on the stimulus, with no invented certainty.',reveal),s('short-answer',scope,'State the strongest supported conclusion and one relevant limit.',f"AUTHORING BRIEF: change one assumption in the same scenario; ask whether the claim still follows.",'A qualified answer whose limitation follows from the supplied evidence.',reveal)],['explicit_form_instruction','balanced_language_opportunities'],[('reading_integration','Evidence has to be understood before its scope can be evaluated.'),('listening_integration','Spoken observations must remain distinct from speaker guesses.')])

    sscope=[target_ids['S'],target_ids['G1']]+chunk_ids
    sprompt=(pack['speaking']['prompt'] if is_reference else f"Speak about {m['topic']} for {stage['speak_seconds'][0]}–{stage['speak_seconds'][1]} seconds in this focused drill. State a relevant answer, develop it at stage {st}, and use suitable prepared language naturally. Do not force all chunks: {'; '.join(chunks)}.")
    add('speaking_production','Plan briefly and communicate independently',sscope,[s('structured-completion',sscope,'Plan meaning in keywords, not a memorised script.',sprompt,'A few relevant ideas and an example; notes are withdrawn for a no-notes transfer task.','Do not grade speaking from the notes or reward rehearsed word counts.'),s('speaking-response',sscope,'Record an independent spoken response.',sprompt,'An audio artifact demonstrating relevance, development and intelligibility at the stated training demand; official criteria inform feedback, not an uncalibrated numeric band.','Give timestamped, evidence-based feedback on meaning and language. A transcript alone cannot establish pronunciation or fluency.')],['oral_corrective_feedback','balanced_language_opportunities'],[('reading_integration','Input supplies relevant ideas without requiring outside expertise.'),('listening_integration','The learner has heard usable language before independent production.')])
    if role==6 or (st>=5 and role==8):
        scope=[target_ids['S'],target_ids['P'],target_ids['M']]
        add('speaking_repair_transfer','Repeat selectively, then answer an unfamiliar follow-up',scope,[s('speaking-response',scope,'Repair one identified communication problem without reading a model.',sprompt+'\nRepeat only after identifying the specific issue; do not force faster speech or identical wording.','A clearer response to the practiced prompt; record this as repaired performance, not unseen readiness.','Identify the changed feature and avoid correcting every accent difference.'),s('speaking-response',scope,'Answer a fresh follow-up that changes the condition or point of view.',f"AUTHORING BRIEF: fresh follow-up about {m['topic']} whose answer cannot be recited from the previous response.",'An independently developed, relevant answer with reduced support.','Judge transfer separately; if the model cannot judge the audio reliably, abstain.')],['fluency_task_repetition','oral_corrective_feedback'],[('speaking_production','A real first attempt is necessary before a targeted repeat can be chosen.')])
    wscope=[target_ids['W'],target_ids['G2']]+chunk_ids
    if is_reference: wprompt=pack['writing']['prompt']
    elif st<6: wprompt=f"Write {stage['write_words'][0]}–{stage['write_words'][1]} words about {m['topic']}. Communicative aim: {stage['writing']} Use prepared language naturally; this is a scaffolded training task, not a complete IELTS Writing task."
    else: wprompt=f"AUTHORING BRIEF: for {m['topic']}, write {'an Academic Task 1 response of at least 150 words using a complete '+m['task1_family']+' stimulus' if (un+role)%2==0 else 'a Task 2 response of at least 250 words using a complete '+m['task2_family']+' prompt'}. Do not score until the prompt or visual and its data have been authored and checked. A focused paragraph drill must be labelled as such, not counted as a full task."
    add('writing_production','Plan, draft and preserve the first response',wscope,[s('structured-completion',wscope,'Identify purpose, required content and organisation before drafting.',wprompt,'A relevant plan that covers the prompt, with accurate data where supplied.','A plan is preparation, not proof of a completed written response.'),s('writing-response',wscope,'Write an independent response without seeing the model.',wprompt,'A saved first draft responding to the complete prompt; feedback references task achievement/response, coherence, lexical resource and grammar. No universal exact model answer.','Keep word-count and completion evidence separate from rubric judgments; disclose uncalibrated grading.')],['written_corrective_feedback','balanced_language_opportunities'],[('grammar_transfer','Sentence relationships have been practised before extended writing.'),('reading_integration','Input demonstrates ideas and organisation without supplying an essay to copy.')])
    repair_scope=[target_ids['W'],target_ids['S'],target_ids['M']]
    add('production_revision','Notice, revise and explain one change',repair_scope,[s('error-correction',repair_scope,'Identify a meaning/organisation problem and a language-control problem in your own response.',f"Use the learner's actual speaking and writing attempts for {lid}; select feedback supported by a quoted text span or audio timestamp.",'A defensible diagnosis; never invent an error because a template expects one.','If there is no relevant error, use an extension challenge rather than fabricate correction.'),s('rewrite',repair_scope,'Revise the affected message and explain the improvement.',f"Use the preserved first response, show the selected issue, then request a revised passage or brief oral reformulation.",'A meaning-preserving or better-supported revision. A correction copied from a model is not independent mastery.','Record the diagnosis, revision and next transfer target separately from the first attempt.')],['written_corrective_feedback','oral_corrective_feedback'],[('speaking_production','An oral artifact supplies real evidence for feedback.'),('writing_production','The first draft must exist before revision is meaningful.')])

    # Conditional lexical repair plans are not compulsory repetitions or claimed implemented routing.
    # One per distinct eligible target because each can fail in a different dimension.
    for tid in eligible:
        w=labels[tid]
        is_chunk=tid in chunk_ids
        add('conditional_chunk_repair' if is_chunk else 'conditional_lexical_repair',f"Conditional repair: {w}",[tid],[s('teaching-card',[tid],f"Diagnose the failed dimension of '{w}' before selecting a repair.",f"CONDITIONAL AUTHORING BRIEF: use the actual first-attempt error for '{w}'. If spelling failed, use the existing practice-only copy/hide/recall sequence. If meaning or usage failed, give one contrast and a new cue. Skip this plan when the target is secure.",'A diagnosis tied to the failed response, not a second automatic Leitner assessment.','No extra XP or promotion for repeating a revealed answer. Existing scheduled-review rules stay untouched.'),s('short-answer',[tid],f"Retrieve '{w}' in a new cue after intervening work.",f"AUTHORING BRIEF: a fresh meaning, role or collocation cue for '{w}' in {m['topic']}; change the context, not only option order.",w,'Record repair evidence separately. Automatic conditional dispatch for non-spelling repairs is proposed and not verified in the current runtime.')],['retrieval_practice','collocation_learning' if is_chunk else 'multidimensional_vocabulary'],[('collocation_retrieval' if is_chunk else 'meaning_in_context','A failed meaningful first attempt, not mere exposure, is needed to justify this optional repair.')],required=False,reason='This target-specific repair is used only if the relevant error occurred. The existence of a repair specification is not a requirement to complete it, an additional assessment score, or evidence that the runtime can route it automatically.')

    # Cumulative check covers all already introduced targets, with no new teaching.
    check=[]
    for scope,typ,goal in [(eligible,'short-answer','Retrieve sampled lexical meanings, exact forms and chunks from fresh cues.'),(grammar_scope,'error-correction','Apply the grammatical and scope relationships to a new sentence.'),([target_ids['R'],target_ids['Q']],'structured-completion','Answer a fresh coherent reading task using its stated constraints.'),([target_ids['L'],target_ids['P']],'structured-completion','Answer a fresh recorded listening task without a transcript or replay.'),([target_ids['S'],target_ids['M']],'speaking-response','Respond independently to an unfamiliar prompt and handle a follow-up.'),([target_ids['W']],'writing-response','Write an independent message at the lesson demand.')]:
        check.append(s(typ,scope,goal,f"SEALED AUTHORING REQUIREMENT {lid}-G: {goal} Topic domain {m['topic']}; use different answer-bearing facts, wording and speaker details from training. The complete item set is not supplied in this blueprint.",'Apply the published first-attempt gate only after all assets, keys and productive rubrics are validated. No answer is shown until the whole coherent task is submitted.','Delayed feedback. A failed gate preserves the evidence and yields a repair recommendation; do not relabel a corrected repeat as a fresh pass.'))
    add('cumulative_mastery','Independent cumulative check',all_ids,check,['retrieval_practice','distributed_practice','balanced_language_opportunities'],[(k,'This previously taught capability must be represented in a cumulative check that introduces no new target.') for k in ['meaning_in_context','grammar_transfer','reading_integration','listening_integration','speaking_production','writing_production','production_revision']],gate='Design policy G1/G2/G3 in README: first-attempt evidence, per-skill floors and delayed fresh transfer. Completion is not an official IELTS band. This gate is blocked until item and scoring validation is complete.')
    assets=[{'id':f'{lid}-text','kind':'reading_text','source_ref':f"examples/{pack['id']}.md#reading" if is_reference else f"authoring-brief:{lid}-R",'available':is_reference},{'id':f'{lid}-script','kind':'listening_script','source_ref':f"examples/{pack['id']}.md#listening" if is_reference else f"authoring-brief:{lid}-L",'available':is_reference},{'id':f'{lid}-audio','kind':'audio','source_ref':f"required-original-recording:{lid}",'available':False},{'id':f'{lid}-gate','kind':'held_out_assessment','source_ref':f"required-sealed-form:{lid}-G",'available':False}]
    blockers=['Natural listening recordings and pronunciation assets are not supplied.','Sealed transfer items, reference-anchored productive assessment and empirical item calibration are not supplied.','Dictionary/corpus checks and distractor review are still required.','Authoring placeholder fields are not production component configuration; compile only against verified runtime contracts.']
    if not is_reference: blockers.insert(0,'The complete original reading text, listening script and item-specific answer bank are authoring briefs, not finished materials.')
    plan={'schema_version':1,'lesson':{'id':lid,'title':f"{m['topic']} — {ROLES[role_index][0]}",'source':{'kind':'original_commissioned_curriculum','reference':f"data/modules.normalized.json#{m['id']}",'section':f"stage {st}, unit {un}, lesson {role}"},'learning_goals':[ROLES[role_index][1],stage['reading'],stage['listening'],stage['speaking'],stage['writing']],'content_inventory':{'targets':targets,'assets':assets},'content_gaps':blockers[:]},'design':{'sequence_strategy':'Keep the mandated vocabulary intake and dictation first; teach the unit language, bridge print to speech, integrate both receptive skills, expand the primary lesson role, produce, revise and check fresh transfer. Optional target repairs are conditional specifications, not a fixed compulsory sequence.','research_principles':list(RESEARCH),'notes':['A linear order implements the authoring prerequisite graph; this does not assume a deployed runtime DAG engine.','All curriculum target selections and exact counts are Vocora design choices, not validated IELTS-band mappings.','Optional repair dispatch and readiness routing are proposed product behavior.','First-attempt evidence, repaired performance and official IELTS scoring must remain separate.']},'evidence_catalog':catalog,'exercises':ex,'coverage':{'source_target_ids':all_ids,'covered_target_ids':all_ids,'uncovered_target_ids':[],'vocora_extensions':[]},'validation':{'status':'blocked','warnings':['Uses the repository placeholder authoring contract, not runtime-ready slide data.','Coverage means targets are assigned in the design, not that they have been learned or the stimuli are fully authored.','These source targets are original commissioned content; they are not passed off as textbook extracts.'], 'blockers':blockers}}
    meta={'id':lid,'number':number,'stage':st,'unit':un,'unit_id':m['id'],'role':role,'title':plan['lesson']['title'],'primary_objective':ROLES[role_index][1],'lexical_targets':words,'collocations':chunks,'grammar':m['grammar'],'reading_goal':stage['reading'],'listening_goal':stage['listening'],'speaking_prompt':sprompt,'writing_prompt':wprompt,'reading_asset_brief':rbrief,'listening_asset_brief':lbrief,'reading_task_family':m['reading_task_family'],'listening_task_family':m['listening_task_family'],'task1_family':m['task1_family'],'task2_family':m['task2_family'],'phonology':stage['phonology'],'support':stage['scaffolding'],'previous_lesson_id':f'L{number-1:04d}' if number>1 else None,'new_target_introduction':role<=4,'recycles_within_unit':role>4,'reference_pack':pack['id'] if is_reference else None,'required_exercises':sum(e['required'] for e in ex),'conditional_exercises':sum(not e['required'] for e in ex),'authoring_slides':sum(len(e['slides']) for e in ex),'source_ids':['I02','I03','I04','I05','I06','I07','R01','R03','R04','R05','R06','R07','R11','R14']+stage['books'],'status':'design_complete_materials_incomplete','exercise_manifest':[{'id':e['id'],'type':e['exercise_type'],'title':e['title'],'required':e['required'],'slides':len(e['slides']),'target_ids':e['source_target_ids'],'research_ids':e['evidence']['research_principle_ids'],'prerequisites':e['prerequisites']} for e in ex]}
    return plan,meta


def md_safe(s):
    return str(s).replace('|','/').replace('\n',' ')


def lesson_md(m):
    required=[e for e in m['exercise_manifest'] if e['required']]
    optional=[e for e in m['exercise_manifest'] if not e['required']]
    return '\n'.join([
      f"#### {m['id']} · {m['title']}",
      f"**Purpose:** {m['primary_objective']} **Prerequisite:** {m['previous_lesson_id'] or 'entry diagnostic / foundation bridge'}. {'Introduce this subset; reuse shared vocabulary identities.' if m['new_target_introduction'] else 'Retrieve previously introduced unit language; do not reset its Leitner state.'}",
      '**Vocabulary:** '+', '.join(m['lexical_targets'])+'.',
      '**Collocations:** '+'; '.join(m['collocations'])+'.',
      '**Grammar / discourse:** '+m['grammar']['primary']+'; '+m['grammar']['secondary']+'.',
      '**Worked diagnostic:** `'+m['grammar']['diagnostic_error']+'` → `'+m['grammar']['model']+'` '+m['grammar']['explanation'],
      '**Reading:** '+m['reading_goal']+' Family: `'+m['reading_task_family']+'`.',
      '**Listening:** '+m['listening_goal']+' Family: `'+m['listening_task_family']+'`. **Sound focus:** '+m['phonology']+'.',
      '**Speaking:** '+m['speaking_prompt'],
      '**Writing:** '+m['writing_prompt'],
      '**Ordered required exercises** (numbers in parentheses are authoring slides): '+ ' → '.join(f"{e['id']}: {e['title']} ({e['slides']})" for e in required)+'.',
      f"**Conditional repair bank:** {len(optional)} target-specific two-slide repairs, one for each eligible word/chunk; see IDs {optional[0]['id']}–{optional[-1]['id']}. These are not compulsory repetitions. Routing is a proposed extension.",
      '**Gate and error rule:** G1 for this lesson; G2 also at role 8. Preserve first attempt; diagnose; repair only the failed dimension; use a different cue at recheck; use existing Leitner scheduling. No feedback inside the final coherent scored task.',
      '**Materials:** '+(f"Original reference text, script, 16 keyed comprehension questions and productive prompts: [{m['reference_pack']}](examples/{m['reference_pack']}.md). Natural audio, missing target glosses and sealed gate still required." if m['reference_pack'] else 'Full text, recorded dialogue/monologue and item-specific keys remain to be authored against the explicit briefs in `data/lesson_index.jsonl`; this entry is not a finished lesson.'),
      '**Evidence:** '+', '.join(f'[{x}]' for x in m['source_ids'])+'. The exact topic, stage assignment and exercise order are design synthesis, not findings of those sources.',''])


def main():
    sources={s['id']:s for s in json.loads((DATA/'sources.json').read_text())}
    stages={s['stage']:s for s in json.loads((DATA/'stages.json').read_text())}
    packs={e['stage']:e for e in json.loads((ROOT/'examples/reference_materials.json').read_text())}
    modules=build_modules();catalog=evidence_catalog(sources)
    outplans=DATA/'lesson_plans.jsonl'; outindex=DATA/'lesson_index.jsonl'; outex=DATA/'exercise_index.jsonl'
    counts=collections.Counter(); summaries=[]; stage_md=collections.defaultdict(list)
    ids=set(); hashes=set(); allmeta=[]
    with outplans.open('w',encoding='utf-8') as fp, outindex.open('w',encoding='utf-8') as fm, outex.open('w',encoding='utf-8') as fe:
        for m in modules:
            for role in range(8):
                plan,meta=make_lesson(m,stages[m['stage']],role,catalog,packs[m['stage']])
                fp.write(json.dumps(plan,ensure_ascii=False,separators=(',',':'))+'\n')
                fm.write(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
                allmeta.append(meta);counts['lessons']+=1
                counts['required_exercises']+=meta['required_exercises'];counts['conditional_exercises']+=meta['conditional_exercises'];counts['authoring_slide_specs']+=meta['authoring_slides']
                for e in plan['exercises']:
                    fe.write(json.dumps({'lesson_id':meta['id'],**e},ensure_ascii=False,separators=(',',':'))+'\n')
                    for sl in e['slides']:
                        assert sl['id'] not in ids;ids.add(sl['id']);counts['slide_'+sl['type']]+=1
                stage_md[m['stage']].append(lesson_md(meta))
    for st in range(1,13):
        stage=stages[st]
        header=f"# Stage {st:02d}: {stage['name']}\n\n{stage['orientation']}. This is a design orientation, not a calibrated band prediction.\n\n"
        (ROOT/'stages'/f'S{st:02d}.md').write_text(header+'\n'.join(stage_md[st]),encoding='utf-8')
    counts['exercise_specs_total']=counts['required_exercises']+counts['conditional_exercises']
    counts['units']=len(modules);counts['stages']=len(stages)
    counts['lexical_occurrences_in_unit_banks']=sum(len(m['lexical_targets']) for m in modules)
    counts['unique_lexical_strings_in_unit_banks']=len({w.casefold() for m in modules for w in m['lexical_targets']})
    counts['chunk_occurrences_in_unit_banks']=sum(len(m['collocations']) for m in modules)
    counts['unique_chunk_strings_in_unit_banks']=len({w.casefold() for m in modules for w in m['collocations']})
    counts['authored_reference_packs']=len(packs);counts['authored_reading_passages']=len(packs);counts['authored_listening_scripts']=len(packs)
    counts['authored_keyed_comprehension_items']=sum(len(p['reading_questions'])+len(p['listening_questions']) for p in packs.values())
    counts['authored_lexical_entries']=sum(len(p['lexicon']) for p in packs.values())
    counts['authored_grammar_diagnostics']=len(modules)
    counts['recorded_audio_assets']=0;counts['sealed_full_mock_forms']=0;counts['runtime_ready_lessons']=0
    dump(ROOT/'audit/counts.json',dict(counts))
    # README is deliberately self-contained, even though stage files support navigation.
    front=(ROOT/'scripts/README-front.md').read_text(encoding='utf-8')
    for key,val in counts.items():front=front.replace('{{'+key+'}}',f'{val:,}')
    stage_table=['| Stage | Lessons | Curriculum demand orientation | Main development |','|---|---|---|---|']
    for st in range(1,13):
        x=stages[st];stage_table.append(f"| {st:02d} | L{(st-1)*80+1:04d}–L{st*80:04d} | {x['orientation']} | {x['name']} |")
    front=front.replace('{{stage_table}}','\n'.join(stage_table))
    appendix=['\n## 18. All 960 lesson specifications\n\nEach lesson below has a matching canonical authoring object in `data/lesson_plans.jsonl` and a complete exercise manifest in `data/lesson_index.jsonl`. These are target-specific specifications, not claims that all their stimuli and answer banks already exist. Core development and optional repair are counted separately.\n']
    for st in range(1,13):
        x=stages[st]
        appendix += [f"### Stage {st:02d} — {x['name']}\n",f"**Scaffolding:** {x['scaffolding']}\n\n**Reading envelope:** {x['read_words'][0]}–{x['read_words'][1]} words. **Listening envelope:** {x['listen_seconds'][0]}–{x['listen_seconds'][1]} seconds. These are authoring policies for integrated tasks, not validated band boundaries; a focused extract may be shorter.\n\n**Progression evidence:** {x['gate']}\n",'<details>\n<summary>Open the 80 lesson specifications for this stage</summary>\n']+stage_md[st]+['</details>\n']
    examples=['\n## 19. Twelve authored reference packs\n\nThese complete **reference packs** contain original texts, scripts and keyed questions. They illustrate a spiral in one domain; they do not replace the missing 948 lesson material packs, natural recordings, full mock forms or productive scoring calibration. Their questions are public teaching material and may never be reused as sealed readiness evidence.\n']
    for p in packs.values():
        text=(ROOT/'examples'/f"{p['id']}.md").read_text()
        # Demote headings so an embedded reference does not reset the README hierarchy.
        text=re.sub(r'^(#{1,4}) ',lambda z:'#'*min(len(z.group(1))+2,6)+' ',text,flags=re.M)
        examples += [f"<details>\n<summary>{p['id']}: {p['title']}</summary>\n\n{text}\n</details>\n"]
    refs=['\n## 20. Source register, provenance and evidential limits\n\nResearch was reviewed through the official publisher records, accessible research text or official summaries identified below. Commercial book coverage is based on publisher descriptions, not an assertion that the complete books were read or reproduced. This is a documented targeted review, **not a preregistered systematic review**. The course has not undergone an outcome trial. Access/review date: **9 September 2026**.\n']
    for s in sources.values():
        refs += [f"### [{s['id']}] {s['title']}\n",f"**Author / year:** {s['author']} ({s['year']}). **Type:** {s['kind']}.\n\n**Source:** {s['url']}\n\n**Access actually used:** {s['access']}\n\n**Supports:** {s['supports']}\n\n**Does not establish:** {s['does_not_support']}\n"]
    refs += ['\n## Final release statement\n\nThe deliverable is an evidence-informed, repository-aligned course architecture, a 960-lesson ordered design, an expanded exercise/slide specification bank and 12 authored reference packs. It is **not** a completed deployable course, an empirically validated score predictor, an official IELTS product, or a guarantee of band 9. The unresolved material, media, implementation and validation requirements are explicit so the next author or implementation agent cannot mistake a large generated specification for finished teaching or assessment content.\n']
    (ROOT/'README.md').write_text(front+'\n'.join(appendix+examples+refs),encoding='utf-8')
    print(json.dumps(dict(counts),indent=2))


if __name__=='__main__':
    main()
