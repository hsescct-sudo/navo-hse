import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('navo_ai', pathlib.Path(__file__).parents[1] / 'api' / 'ai.py')
ai = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai)


class AIReviewTests(unittest.TestCase):
    def test_rca_does_not_forge_review_or_evidence(self):
        raw = {'status': 'Approved', 'method': 'invented', 'confidence': 'certain', 'analysis': [{'label':'Why', 'hypothesis':'Check barrier', 'status':'Verified', 'evidence_ids':['allowed','forged']}], 'data_gaps':['Need inspection'], 'recommended_actions':[{'action':'Verify', 'verification':'Site check'}]}
        with patch.object(ai, 'claude', return_value=raw):
            result=ai.run('rca', {'method':'Barrier Analysis','evidence':{'title':'Test'},'source_ids':['allowed']})
        self.assertEqual(result['method'],'Barrier Analysis')
        self.assertEqual(result['status'],'Draft for investigator review')
        self.assertEqual(result['analysis'][0]['status'],'Hypothesis')
        self.assertEqual(result['analysis'][0]['evidence_ids'],['allowed'])
        self.assertEqual(result['confidence'],'low')
        with self.assertRaises(ValueError): ai.run('rca', {'method':'invented'})
        with self.assertRaises(ValueError): ai.run('rca', {'evidence':'invalid'})

    def test_analysis_normalises_risk_and_supported_controls(self):
        raw = {'likelihood': 9, 'severity': 5, 'confidence': 'certain', 'category': 'invented',
               'control_plan': [{'hierarchy': 'Engineering', 'protects': 'Both', 'action': 'Fit a guard'},
                                {'hierarchy': 'Invented', 'action': 'Unsupported'}],
               'bowtie': {'hazard': 'Moving parts', 'threats': ['Missing guard']}}
        result = ai.clean_analysis(raw)
        self.assertEqual(result['risk_score'], 25)
        self.assertEqual(result['risk_level'], 'Critical')
        self.assertEqual(result['confidence'], 'low')
        self.assertIsNone(result['category'])
        self.assertEqual(len(result['control_plan']), 1)
        self.assertEqual(result['bowtie']['threats'], ['Missing guard'])

    def test_request_uses_existing_provider_and_review_prompt(self):
        with patch.object(ai, 'claude', return_value={'likelihood': 3, 'severity': 5}) as provider:
            result = ai.run('analyze', {'rtype': 'Observation', 'text': 'Missing machine guard'})
        self.assertEqual(result['risk_score'], 15)
        self.assertIn('preventive barriers', provider.call_args.args[0][0]['text'])
        self.assertIn('untrusted evidence', provider.call_args.args[0][0]['text'])

    def test_photo_request_and_due_dates(self):
        with patch.object(ai, 'claude', return_value={'likelihood': 4, 'severity': 5, 'corrective_actions': [{'title': 'Isolate the hazard', 'due_days': 999}]}) as provider:
            result = ai.run('analyze', {'image': 'YWJj', 'mediaType': 'image/jpeg', 'text': ''})
        self.assertEqual(provider.call_args.args[0][0]['type'], 'image')
        self.assertEqual(result['corrective_actions'][0]['due_days'], 1)
        self.assertEqual(result['suggested_close_out_days'], 1)
        with self.assertRaises(ValueError):
            ai.run('analyze', {'image': 'bad!', 'mediaType': 'image/jpeg'})

    def test_outlook_is_bounded_and_retains_data_gaps(self):
        with patch.object(ai, 'claude', return_value={'score': 999, 'rating': 'Critical', 'confidence': 'certain', 'data_gaps': ['Hours missing']}) as provider:
            result = ai.run('outlook', {'data': {'hours': 0}, 'level': 'Corporation'})
        self.assertEqual(result['score'], 100)
        self.assertEqual(result['confidence'], 'low')
        self.assertEqual(result['data_gaps'], ['Hours missing'])
        self.assertIn('not an injury prediction', provider.call_args.args[0][0]['text'])


if __name__ == '__main__':
    unittest.main()
