  method FindMax(a: array<int>) returns (i: int)
    requires a != null
    requires a.Length > 0
    ensures 0 <= i && i < a.Length 
    ensures  forall k :: 0 <= k && k < a.Length ==> a[i] >= a[k]
  {
    var idx := 0;
    var j := idx;
    i := idx;
    while idx < a.Length
	//  invariant 0 <= i && i < a.Length 
      invariant idx <= a.Length
      invariant forall k :: 0 <= k && k < idx ==> a[i] >= a[k]
	//  decreases a.Length - idx
	  tactic invGen();
    {
      if a[idx] > a[i] {
        i := idx;
      }
      idx := idx + 1;
    }
  }


  tactic invGen()
  {
    tvar post :| post_conds();
	invariant(post);
  }
