datatype Dummy = A | B

lemma dummyLemma(m: Dummy)
ensures false
{
	assume false;
}

lemma testTacArg(m: Dummy)
 ensures false
{
   tac(tacArg);
}

tactic tac(t: Tactic)
{
  t(1);
}

tactic tacArg(i: int)
{
  if (i > 0){
    tvar vs := variables();
    tvar ls := lemmas();	
    explore(ls, vs);
	}
}


