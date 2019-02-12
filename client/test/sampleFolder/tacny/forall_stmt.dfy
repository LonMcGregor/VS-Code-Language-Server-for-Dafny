
predicate P(x : int)

lemma dummyLemma()
ensures forall x :: P(x)
{
  test();
}

lemma dummyLemma2()
ensures forall x :: P(x)
{
  test();
}


tactic {:partial} test(){

  tvar p :| p in tactic.ensures;

  tactic forall {:vars z} p
  {
	assume false;
  }
}
