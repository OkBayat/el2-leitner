#!/usr/bin/env python3
"""Independent, fail-closed contract-oriented checks; NOT Vocora's own validator.
Structural success does not establish educational validity or deployment readiness.
Python 3.10+, no third-party packages. Stream large banks rather than load them all.
"""
from __future__ import annotations
import collections
import copy
import json
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[1]
TYPES={'teaching-card','choice','truth','matching','classification','ordering','cloze','structured-completion','short-answer','word-formation','error-correction','rewrite','pronunciation','dictation','speaking-response','writing-response'}
FIELDS={
 'root':{'schema_version','lesson','design','evidence_catalog','exercises','coverage','validation'},
 'lesson':{'id','title','source','learning_goals','content_inventory','content_gaps'},
 'source':{'kind','reference','section'},
 'inventory':{'targets','assets'},
 'target':{'id','kind','label','source_ref','leitner_eligible'},
 'asset':{'id','kind','source_ref','available'},
 'design':{'sequence_strategy','research_principles','notes'},
 'catalog':{'id','kind','citation','claim'},
 'exercise':{'id','position','exercise_type','title','objective','required','prerequisites','source_target_ids','extension_ids','evidence','completion','slides'},
 'evidence':{'source_refs','research_principle_ids','sequence_reason'},
 'completion':{'evidence','mastery_gate'},
 'prerequisite':{'exercise_id','reason'},
 'slide':{'id','type','purpose','target_ids','contract_status','data'},
 'data':{'_placeholder','instruction_intent','prompt_or_stimulus','expected_response','feedback_intent'},
 'coverage':{'source_target_ids','covered_target_ids','uncovered_target_ids','vocora_extensions'},
 'extension':{'id','reason'},
 'validation':{'status','warnings','blockers'}
}

def check_plan(p):
    errors=[]
    def fail(msg):errors.append(msg)
    def shape(o,key):
        if not isinstance(o,dict):fail(key+': not object');return False
        if set(o)!=FIELDS[key]:fail(f'{key}: fields mismatch {set(o)^FIELDS[key]}')
        return True
    def text(v,path):
        if not isinstance(v,str) or not v.strip():fail(path+': empty/non-string')
    def string_array(v,path,nonempty=False):
        if not isinstance(v,list):fail(path+': not array');return []
        if nonempty and not v:fail(path+': empty')
        for x in v:text(x,path)
        if len(set(v))!=len(v):fail(path+': duplicates')
        return v
    shape(p,'root')
    if p.get('schema_version')!=1:fail('schema_version')
    l=p['lesson'];shape(l,'lesson');text(l['id'],'lesson.id');text(l['title'],'lesson.title');shape(l['source'],'source')
    for k in ['kind','reference']:text(l['source'][k],'source.'+k)
    string_array(l['learning_goals'],'goals',True);string_array(l['content_gaps'],'gaps')
    inv=l['content_inventory'];shape(inv,'inventory');tids=[];eligible=set();aids=[]
    for t in inv['targets']:
        shape(t,'target')
        for k in ['id','kind','label','source_ref']:text(t[k],'target.'+k)
        if type(t['leitner_eligible']) is not bool:fail('eligible not boolean')
        tids.append(t['id'])
        if t['leitner_eligible']:eligible.add(t['id'])
    if not eligible:fail('empty eligible scope')
    if len(set(tids))!=len(tids):fail('duplicate targets')
    for a in inv['assets']:
        shape(a,'asset');aids.append(a['id'])
        for k in ['id','kind','source_ref']:text(a[k],'asset.'+k)
        if type(a['available']) is not bool:fail('asset available not boolean')
    if len(set(aids))!=len(aids):fail('duplicate assets')
    d=p['design'];shape(d,'design');text(d['sequence_strategy'],'sequence_strategy');string_array(d['notes'],'notes')
    catalog={}
    for c in p['evidence_catalog']:
        shape(c,'catalog')
        for k in ['id','kind','citation','claim']:text(c[k],'catalog.'+k)
        if c['id'] in catalog:fail('duplicate evidence')
        if c['kind'] not in {'research','source_rule','design_synthesis'}:fail('unknown evidence kind')
        catalog[c['id']]=c['kind']
    for r in string_array(d['research_principles'],'design principles',True):
        if catalog.get(r)!='research':fail('invalid design research id')
    cv=p['coverage'];shape(cv,'coverage');extensions=set()
    for x in cv['vocora_extensions']:
        shape(x,'extension');text(x['id'],'extension id');text(x['reason'],'extension reason')
        if x['id'] in extensions:fail('duplicate extension')
        extensions.add(x['id'])
    if set(tids)&extensions:fail('target extension namespace collision')
    for k in ['source_target_ids','covered_target_ids','uncovered_target_ids']:string_array(cv[k],k)
    if set(cv['source_target_ids'])!=set(tids):fail('coverage source mismatch')
    if set(cv['covered_target_ids'])&set(cv['uncovered_target_ids']):fail('coverage overlap')
    if set(cv['covered_target_ids'])|set(cv['uncovered_target_ids'])!=set(tids):fail('coverage partition mismatch')
    prior=set();slides_seen=set();source_union=set();last_position=-1
    if len(p['exercises'])<2:fail('missing opening exercises')
    for e in p['exercises']:
        shape(e,'exercise')
        for k in ['id','exercise_type','title','objective']:text(e[k],'exercise.'+k)
        if e['id'] in prior:fail('duplicate exercise id')
        if type(e['required']) is not bool:fail('required not boolean')
        if type(e['position']) is not int or e['position']<=last_position:fail('position order')
        last_position=e['position']
        for pre in e['prerequisites']:
            shape(pre,'prerequisite');text(pre['reason'],'prerequisite.reason')
            if pre['exercise_id'] not in prior:fail('non-backward prerequisite')
        shape(e['evidence'],'evidence');string_array(e['evidence']['source_refs'],'source refs',True);text(e['evidence']['sequence_reason'],'sequence reason')
        for r in string_array(e['evidence']['research_principle_ids'],'exercise research',True):
            if catalog.get(r)!='research':fail('invalid exercise research id')
        shape(e['completion'],'completion');text(e['completion']['evidence'],'completion evidence')
        if e['completion']['mastery_gate'] is not None:text(e['completion']['mastery_gate'],'mastery gate')
        src=set(string_array(e['source_target_ids'],'exercise targets'));ext=set(string_array(e['extension_ids'],'exercise extensions'))
        if not src|ext:fail('empty exercise scope')
        if src-set(tids) or ext-extensions:fail('unknown exercise target')
        source_union|=src
        union=set()
        if not e['slides']:fail('empty slides')
        for sl in e['slides']:
            shape(sl,'slide')
            for k in ['id','type','purpose']:text(sl[k],'slide.'+k)
            if sl['id'] in slides_seen:fail('duplicate slide id')
            slides_seen.add(sl['id'])
            if sl['type'] not in TYPES:fail('unknown slide type')
            if sl['contract_status']!='placeholder':fail('non-placeholder contract')
            scope=set(string_array(sl['target_ids'],'slide scope',True));union|=scope
            if scope-(set(tids)|extensions):fail('unknown slide target')
            data=sl['data'];shape(data,'data')
            if data['_placeholder'] is not True:fail('placeholder data flag')
            for k in ['instruction_intent','prompt_or_stimulus','expected_response','feedback_intent']:text(data[k],'data.'+k)
        if union!=src|ext:fail('slide/exercise scope mismatch')
        prior.add(e['id'])
    if source_union!=set(cv['covered_target_ids']):fail('coverage/exercises mismatch')
    if len(p['exercises'])>=2:
        one,two=p['exercises'][:2]
        if one['exercise_type']!='vocabulary_intake' or one['prerequisites']:fail('invalid intake opening')
        if two['exercise_type']!='spelling_dictation':fail('invalid dictation opening')
        for e in [one,two]:
            if set(e['source_target_ids'])!=eligible or e['extension_ids']:fail('opening scope mismatch')
        if not any(s['type']=='choice' for s in one['slides']):fail('missing intake choice')
        if not any(s['type']=='dictation' for s in two['slides']):fail('missing dictation')
        if one['id'] not in {r['exercise_id'] for r in two['prerequisites']}:fail('dictation missing intake dependency')
    v=p['validation'];shape(v,'validation');string_array(v['warnings'],'warnings');string_array(v['blockers'],'blockers')
    if v['status'] not in {'ready','blocked'}:fail('invalid readiness status')
    if v['status']=='blocked' and not v['blockers']:fail('blocked without reason')
    if v['status']=='ready' and (v['blockers'] or cv['uncovered_target_ids'] or l['content_gaps']):fail('false ready')
    if not any('placeholder' in s.lower() for s in v['warnings']):fail('placeholder warning missing')
    return sorted(set(errors))


def main():
    errors=[];n=collections.Counter();global_ex=set();global_sl=set();first=None
    plans=ROOT/'data/lesson_plans.jsonl'
    with plans.open(encoding='utf-8') as f:
        for ix,line in enumerate(f,1):
            p=json.loads(line); first=first or p
            lid=p['lesson']['id']
            if lid!=f'L{ix:04d}':errors.append(f'{lid}: nonsequential lesson id')
            e=check_plan(p)
            if e:errors.extend(f'{lid}: {x}' for x in e)
            n['lessons']+=1;n['production_blocked']+=p['validation']['status']=='blocked'
            for ex in p['exercises']:
                if ex['id'] in global_ex:errors.append('global exercise duplicate')
                global_ex.add(ex['id']);n['required_exercises' if ex['required'] else 'conditional_exercises']+=1
                for sl in ex['slides']:
                    if sl['id'] in global_sl:errors.append('global slide duplicate')
                    global_sl.add(sl['id']);n['authoring_slide_specs']+=1
    if n['lessons']!=960:errors.append('lesson count is not 960')
    counts=json.loads((ROOT/'audit/counts.json').read_text())
    for k in ['lessons','required_exercises','conditional_exercises','authoring_slide_specs']:
        if counts[k]!=n[k]:errors.append('count mismatch '+k)
    # Deliberately invalid mutations confirm selected important rejection paths.
    mutations=[]
    def mutation(label,change):
        p=copy.deepcopy(first);change(p);passed=bool(check_plan(p));mutations.append({'case':label,'invalid_case_rejected':passed})
        if not passed:errors.append('checker failed mutation '+label)
    mutation('opening type',lambda p:p['exercises'][0].update(exercise_type='wrong'))
    mutation('extra root field',lambda p:p.update(unsupported=True))
    mutation('unknown slide type',lambda p:p['exercises'][0]['slides'][0].update(type='made-up'))
    mutation('forward prerequisite',lambda p:p['exercises'][1]['prerequisites'][0].update(exercise_id=p['exercises'][-1]['id']))
    mutation('target coverage',lambda p:p['coverage'].update(covered_target_ids=[]))
    mutation('false readiness',lambda p:p['validation'].update(status='ready'))
    packs=json.loads((ROOT/'examples/reference_materials.json').read_text());itemids=set();models=[]
    for p in packs:
        for k in ['reading_questions','listening_questions']:
            if len(p[k])!=8:errors.append(p['id']+' does not have 8 '+k)
            for q in p[k]:
                if q['id'] in itemids:errors.append('duplicate reference item')
                itemids.add(q['id'])
                for field in ['prompt','answer','rationale']:
                    if not str(q.get(field,'')).strip():errors.append(q['id']+' missing '+field)
                if q['type'] not in TYPES:errors.append(q['id']+' invalid type')
        wc=len(re.findall(r"\b[\w]+(?:[’'\-][\w]+)*\b",p['writing']['model']))
        models.append({'reference':p['id'],'stage':p['stage'],'writing_model_words':wc,'exam_certification':'not claimed'})
        if p['stage']>=7 and wc<250:errors.append(p['id']+' Task 2 model below 250 words')
        if p['stage']==6 and wc<150:errors.append(p['id']+' Task 1 model below 150 words')
        if p['listening']['audio_available']:errors.append('unprovided audio marked available')
    if len(itemids)!=192:errors.append('reference question count mismatch')
    # Simple direct constraints in supplied exact-answer questions.
    limits=[]
    for p in packs:
        for q in p['reading_questions']+p['listening_questions']:
            if re.search(r'write ONE WORD',q['prompt'],re.I) and isinstance(q['answer'],str):
                if len(q['answer'].split())>1:limits.append({'id':q['id'],'answer':q['answer'],'review':'Check allowed variants/format manually'})
    report={'checked_at':'2026-09-09','checker':'Independent contract-oriented package checker; repository validator NOT executed',
      'structural_status':'pass' if not errors else 'fail','counts':dict(n),'authored_reference_questions':len(itemids),
      'negative_mutation_checks':mutations,'writing_model_checks':models,'word_limit_items_needing_manual_review':limits,
      'errors':errors,'production_readiness':'blocked','runtime_ready_lessons':0,
      'limitations':['No application integration or rendering test was executed.','No recorded audio or sealed full mock form is supplied.','Most stimulus/question entries are authoring briefs, not complete question banks.','Dictionary/corpus review, pedagogical review, distractor validation and empirical calibration remain outstanding.','Structural target assignment is not proof of target mastery or an IELTS score.','No universal band-9 guarantee or outcome-trial evidence is claimed.']}
    (ROOT/'audit/validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(report,indent=2,ensure_ascii=False))
    return 0 if not errors else 1

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('Validation failed: '+str(exc),file=sys.stderr);sys.exit(2)
