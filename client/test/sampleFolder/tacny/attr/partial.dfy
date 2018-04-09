
lemma dummyLemma()
ensures false
{
	assume false;
}

lemma ltest()
 ensures false
{
   tac1();
}

lemma ltest2()
 ensures false
{
   tac2() {:partial};
}

tactic {:partial} tac1()
{
	assert true;	
}

tactic  tac2()
{
	assert true;	
}
