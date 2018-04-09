
lemma iftest1()
 ensures false
{
   tacIf();
}

lemma iftest2()
 ensures false
{
   tacElse();
}

lemma Alttest()
 ensures false
{
   tacAlt();
}




tactic tacIf()
{
  if (2 > 1){
  	assume false;
  }
}

tactic tacElse()
{
  if (2 < 1){
  	assert true;
  } else{
    assume false;
  }
}

tactic tacAlt()
{
  if {
    case 1 > 2 => assert true;
	case 2 > 1=> assert true;
  }
}

