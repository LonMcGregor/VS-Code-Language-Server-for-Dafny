predicate P(x : nat)

lemma mylemma(x : nat)
  ensures forall z :: z < x ==> P(z)
 {
   var z := 0;
   //assert forall x :: 0 < x < 100 ==> false;
  test(){:partial};
  }


tactic test(){
   tvar pp := post_conds();
   tactic var z0 := 3;
   tactic forall {:vars z} forall x :: 0 < x < 100 ==> false
   {
     assert z < 0;
	 assume false;
   }
}