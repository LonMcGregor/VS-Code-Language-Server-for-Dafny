
lemma whileTest()
 ensures false
{
   tacWhile();
}


tactic tacWhile()
{
  tvar t := 0;
  
  while (t < 2){
  	assert true;
	t := t + 1;
  }
  
  assume false;
}

