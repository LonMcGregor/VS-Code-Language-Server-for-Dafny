lemma altChoice()
 ensures false
{
   tacAlt();
}



tactic tacIf()
{
  if (*){
  	assert true;
  }else{
	assume false;
  }
}

tactic tacAlt()
{
  if {
    case * => assume true
	case * => assert true;
  }
  
  assert true;
  
    if {
    case * => assume true
	case * => assume false;
  }
}