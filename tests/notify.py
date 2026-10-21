"""Checks for api/notify.py with the database and email service replaced by fakes."""
import os, sys, unittest
from datetime import datetime, timedelta
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from api import notify

NOW = datetime(2026, 10, 15, 7, 0, tzinfo=notify.RIYADH)
MS = int(NOW.timestamp() * 1000)
DAY = notify.DAY_MS
DATA = {
    'settings': [{'data': {'automation': {'email': {'recipients': ['hse@example.com'], 'daily': True, 'ceo': True, 'env': True}}, 'kpi': {'targets': {'Corporation': {'ltifr': 0.13, 'trcf': 0.11, 'ltisr': 2.33}}}}}],
    'projects': [{'id': 'p1', 'name': 'Riyadh <Tower>'}],
    'actions': [{'id': 'a1', 'title': 'Fix guardrail', 'project': 'p1', 'owner': 'Ali', 'due': MS - 20 * DAY}, {'id': 'a2', 'title': 'Tag scaffold', 'project': 'p1', 'owner': 'Sara', 'due': MS + DAY}],
    'reports': [{'rt': 'Incident', 'kind': 'Injury', 'severity': 'Lost Time', 'description': 'Hand injury', 'project': 'p1', 'ts': MS - 2 * DAY, 'event_ts': MS - 2 * DAY, 'lost_days': 3, 'inc_class': 'Class B', 'investigation': {}}],
    'hsse_records': [{'data': {'month': '2026-09', 'empHours': 600000, 'conHours': 400000, 'diesel': 2, 'nhRecycled': 10, 'nhDisposed': 30}}],
}

class T(unittest.TestCase):
    def setUp(self):
        self.sent = []
        notify.db = lambda table, q: [r for r in DATA[table] if not ('kind=eq.env' in q)] if table != 'hsse_records' or 'kind=eq.monthly' in q else []
        notify.send = lambda to, subject, body: self.sent.append((to, subject, body))
    def test_day_15_sends_digest_and_ceo(self):
        r = notify.run(NOW)
        self.assertEqual(r['sent'], ['daily digest', 'CEO summary'])
        body = self.sent[0][2]
        self.assertIn('Division director', body)          # 20 days overdue escalates to director
        self.assertIn('Riyadh &lt;Tower&gt;', body)        # names are escaped
        self.assertIn('Hand injury', body)                  # serious incident listed
        ceo = self.sent[1][2]
        self.assertIn('1,000,000', ceo)                     # man-hours year to date
        self.assertIn('1.00', ceo)                          # LTIFR = 1 x 1M / 1M
    def test_env_on_first(self):
        r = notify.run(datetime(2026, 10, 1, 7, tzinfo=notify.RIYADH))
        self.assertIn('environmental summary', r['sent'])
        env = [s for s in self.sent if 'environmental' in s[1]][0][2]
        self.assertIn('25.0%', env)                         # diversion 10 / (10 + 30)
        self.assertIn('2,380 L', env)                       # 2 t diesel x 1,190 L/t
    def test_no_recipients(self):
        DATA['settings'][0]['data']['automation']['email']['recipients'] = []
        try:
            self.assertEqual(notify.run(NOW)['sent'], [])
        finally:
            DATA['settings'][0]['data']['automation']['email']['recipients'] = ['hse@example.com']
    def test_missing_config(self):
        for k in ('RESEND_API_KEY', 'NAVO_MAIL_FROM', 'NAVO_SUPABASE_SERVICE_KEY'):
            os.environ.pop(k, None)
        self.assertEqual(len(notify.missing_config()), 3)

if __name__ == '__main__':
    unittest.main()
