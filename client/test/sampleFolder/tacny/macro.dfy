
datatype Bool = False | True
datatype Nat = Zero | Suc(Nat)

function add(x: Nat, y: Nat): Nat
{
  match x
  case Zero => y
  case Suc(w) => Suc(add(w, y))
}

function mul(x: Nat, y: Nat): Nat
{
  match x
  case Zero => Zero
  case Suc(w) => add(y, mul(w, y))
}

function minus(x: Nat, y: Nat): Nat
{
  match x
  case Zero => Zero
  case Suc(a) => match y
    case Zero => x
    case Suc(b) => minus(a, b)
}

function geq(x: Nat, y: Nat): Bool
{
  match y
  case Zero => True
  case Suc(b) => match x
    case Zero => False
    case Suc(a) => geq(a, b)
}

tactic add_macro()
{
  assert 2 >1;
  assert forall m,n :: add(Suc(m),n) == Suc(add(m,n));
  assert forall m, n :: add(m, n) == add(n, m);
}

lemma taut_minus_add()
  ensures forall m, n :: minus(add(m, n), n) == m;
{
  add_macro();
  //  assert forall m,n :: add(Suc(m),n) == Suc(add(m,n));
  //assert forall m, n :: add(m, n) == add(n, m);
}


