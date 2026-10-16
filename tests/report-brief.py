import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from api.report_complete import sections
class BriefContract(unittest.TestCase):
 def test_selected_section_wins_over_generic_counts(self):
  data={'brief':True,'dashboardId':'es','cur':{'projects':20,'manpower':6000},'reportSections':[{'title':'E&S / Accommodation','headers':['Indicator','Value'],'rows':[['Workers assessed',100],['Non-compliant items',3]]}]}
  self.assertEqual(sections(data),[('E&S / Accommodation',['Indicator','Value'],[['Workers assessed',100],['Non-compliant items',3]])])
 def test_brief_has_bounded_section_and_row_count(self):
  section={'title':'Selected view','headers':[str(i) for i in range(12)],'rows':[list(range(12)) for _ in range(20)]}
  result=sections({'brief':True,'reportSections':[section,section]})
  self.assertEqual(len(result),1);self.assertEqual(len(result[0][1]),8);self.assertEqual(len(result[0][2]),6);self.assertTrue(all(len(r)==8 for r in result[0][2]))
 def test_registers_are_not_added_to_brief(self):
  self.assertFalse(any('register' in title.lower() for title,_,_ in sections({'brief':True,'register':[{'title':'Private source'}]})))
if __name__=='__main__':unittest.main()
