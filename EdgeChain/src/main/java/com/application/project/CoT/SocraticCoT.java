public class SocraticCoT {
    private ProblemDecomposer problemDecomposer;
    private SubproblemSolver subproblemSolver;
    
    public SocraticCoT() {
        problemDecomposer = new ProblemDecomposer();
        subproblemSolver = new SubproblemSolver();
    }
    
    public Solution solveProblem(Problem problem) {
        List<Subproblem> subproblems = problemDecomposer.decomposeProblem(problem);
        Solution finalSolution = new Solution();
        
        for (Subproblem subproblem : subproblems) {
            Solution subproblemSolution = subproblemSolver.solveSubproblem(subproblem);
            // Logic to integrate subproblem solutions into the final solution
            finalSolution.merge(subproblemSolution);
            
        }
        
        return finalSolution;
    }
}
