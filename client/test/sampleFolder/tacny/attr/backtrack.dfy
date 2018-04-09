
lemma testBacktrack()
 ensures false
{
   tacAlt() {:backtrack 2};
}


tactic {:partial} tacAlt()
{
  if {
    case * => assert true;
	case * => assert true;
	case * => assume true;
  }
}

