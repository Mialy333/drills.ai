"""Execute only reviewed, fixed repository examples, never user/model submissions."""
import pytest
from src.ai_generator.technical_interview import load_catalog, TechnicalRequest


def case(case_id):
    return next(c for c in load_catalog()['cases'] if c['id']==case_id)


def function(case_id, field, name):
    namespace={}
    exec(compile(case(case_id)[field], '<fixed-interview-example>', 'exec'), namespace)
    return namespace[name]


def test_shared_history_bug_reproduces_and_solution_isolates_calls():
    broken=function('python-state','code','add_message')
    broken('A');assert broken('B')==['Candidate A','Candidate B','A','B']
    fixed=function('python-state','solution_code','add_message')
    first=fixed('A');second=fixed('B')
    assert first==['A'] and second==['B'] and first is not second
    original=['Existing'];assert fixed('Next',original)==['Existing','Next'];assert original==['Existing']


@pytest.mark.parametrize('call',[None,{}, {'name':'delete','arguments':{'a':1,'b':2}}, {'name':'add','arguments':None}, {'name':'add','arguments':{'a':1}}, {'name':'add','arguments':{'a':1,'b':2,'extra':3}}, {'name':'add','arguments':{'a':True,'b':2}}, {'name':'add','arguments':{'a':'1','b':2}}, {'name':'add','arguments':{'a':1.5,'b':2}}])
def test_tool_solution_rejects_invalid_inputs(call):
    fixed=function('python-tool-validation','solution_code','run_tool')
    with pytest.raises(ValueError):fixed(call)


def test_tool_solution_preserves_zero_success_and_original_masks_errors():
    fixed=function('python-tool-validation','solution_code','run_tool')
    assert fixed({'name':'add','arguments':{'a':-2,'b':2}})==0
    assert fixed({'name':'add','arguments':{'a':3,'b':4}})==7
    broken=function('python-tool-validation','code','run_tool')
    assert broken({'name':'add','arguments':{'a':'oops','b':2}})==0


def test_python_cases_have_fixed_rubrics_and_are_accepted_by_api():
    for key in ['python-state','python-tool-validation']:
        entry=case(key)
        assert entry['category']=='python'
        for lang in ['fr','en']:assert len(entry[lang]['criteria'])==4
        assert TechnicalRequest(case_id=key,answer='Explain my correction and the test cases I would run here.',consent=True)
