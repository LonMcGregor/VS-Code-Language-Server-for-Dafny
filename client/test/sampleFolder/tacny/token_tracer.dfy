
predicate P(x : int)

lemma dummyLemma()
ensures forall x :: P(x) 
ensures false
{
  //test(){:backtrack };
  test2();
}

tactic test2(){
tvar m := 0;
test3();
}

tactic test3()
{
assert true;
}


tactic test(){
  tvar i := 0;
  tvar p :| p in post_conds();
  assume false;
}
